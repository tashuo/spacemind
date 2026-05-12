import { create } from 'zustand'
import type { Conversation, PaletteKey, Space } from '@/lib/schema'
// 必须用 namespace 导入,而不是解构 —— 让测试用 vi.spyOn(db, 'putSpace') 能拦截到调用
import * as db from '@/lib/db'
import * as spacesLib from '@/lib/spaces'
import * as zipImport from '@/lib/zip-import'

export type ToastKind = 'info' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  text: string
}

export interface ImportSummary {
  vendor: zipImport.Vendor
  conversationsAdded: number
  conversationsUpdated: number
  messagesAdded: number
}

interface State {
  loaded: boolean
  spaces: Space[]
  conversations: Conversation[]
  importing: boolean
  toasts: Toast[]

  load: () => Promise<void>
  createSpace: (name: string, color: PaletteKey) => Promise<string>
  renameSpace: (id: string, name: string) => Promise<void>
  removeSpace: (id: string) => Promise<void>

  importFromZip: (buf: ArrayBuffer) => Promise<ImportSummary>

  pushToast: (kind: ToastKind, text: string) => void
  dismissToast: (id: number) => void
}

// 模块级单调 id —— 同一进程内不会重复;Service Worker 重启不影响,toast 本身不持久化
let toastSeq = 0

/** Toast 自动消失时长。集中常量,便于将来调参或换成可配置 */
const TOAST_TTL_MS = 4000

export const useAppStore = create<State>((set, get) => ({
  loaded: false,
  spaces: [],
  conversations: [],
  importing: false,
  toasts: [],

  // load 失败不翻 loaded=true —— 保留给 UI 重试入口,不能伪装成"加载完毕但空"
  load: async () => {
    try {
      const [spaces, conversations] = await Promise.all([
        db.allSpaces(),
        db.allConversations(),
      ])
      set({
        loaded: true,
        spaces: spacesLib.sortedForDisplay(spaces),
        conversations,
      })
    } catch {
      get().pushToast('error', 'Failed to load')
    }
  },

  createSpace: async (name, color) => {
    const id = crypto.randomUUID()
    const now = Date.now()
    const newSpace = spacesLib.createSpace({ id, name, color }, now)
    const before = get().spaces
    // 乐观更新:先改内存,再落盘;落盘失败回滚 + toast + 抛出
    set({ spaces: spacesLib.sortedForDisplay([...before, newSpace]) })
    try {
      await db.putSpace(newSpace)
      return id
    } catch (e) {
      set({ spaces: before })
      get().pushToast('error', 'Failed to save space')
      throw e
    }
  },

  renameSpace: async (id, name) => {
    const before = get().spaces
    const target = before.find((s) => s.id === id)
    // 找不到目标静默返回 —— 调用方可能拿着已被别处删掉的旧 id,不该抛
    if (!target) return
    const now = Date.now()
    const renamed = spacesLib.renameSpace(target, name, now)
    const nextList = before.map((s) => (s.id === id ? renamed : s))
    set({ spaces: spacesLib.sortedForDisplay(nextList) })
    try {
      await db.putSpace(renamed)
    } catch (e) {
      set({ spaces: before })
      get().pushToast('error', 'Failed to rename space')
      throw e
    }
  },

  removeSpace: async (id) => {
    const before = get().spaces
    if (!before.some((s) => s.id === id)) return
    set({ spaces: spacesLib.deleteSpaceFromList(before, id) })
    try {
      await db.deleteSpace(id)
    } catch (e) {
      set({ spaces: before })
      get().pushToast('error', 'Failed to delete space')
      throw e
    }
  },

  // 整包导入:JSZip → vendor 解析 → 用户字段保留的 upsert → bulk 写库 → 刷新内存
  // 失败时 importing 必须重置,否则 UI 进度条永远转
  importFromZip: async (buf) => {
    set({ importing: true })
    try {
      const result = await zipImport.importFromZipBuffer(buf)

      // 逐条 upsert:已存在则保留用户元数据(spaceId / tags / starred / note / capturedAt),
      // 仅覆盖平台层字段(title / preview / platformUpdatedAt / messageCount / url / platform);
      // 不存在则原样写入。已存在的 capturedAt 保持首次导入时间,符合"导入即抓取时间"语义
      let added = 0
      let updated = 0
      const merged: Conversation[] = []
      for (const incoming of result.conversations) {
        const existing = await db.getConversation(incoming.id)
        if (existing) {
          merged.push({
            ...incoming,
            spaceId: existing.spaceId,
            tags: existing.tags,
            starred: existing.starred,
            note: existing.note,
            capturedAt: existing.capturedAt,
          })
          updated++
        } else {
          merged.push(incoming)
          added++
        }
      }

      await db.bulkPutConversations(merged)
      await db.bulkPutMessages(result.messages)

      const conversations = await db.allConversations()
      set({ conversations, importing: false })

      get().pushToast(
        'info',
        `Imported ${added} new, updated ${updated} from ${result.vendor}`
      )

      return {
        vendor: result.vendor,
        conversationsAdded: added,
        conversationsUpdated: updated,
        messagesAdded: result.messages.length,
      }
    } catch (e) {
      set({ importing: false })
      const msg = e instanceof Error ? e.message : 'Failed to import'
      get().pushToast('error', msg)
      throw e
    }
  },

  pushToast: (kind, text) => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }))
    // 4s 后自动消失;若用户主动 dismiss,这里再次 filter 是空操作
    setTimeout(() => get().dismissToast(id), TOAST_TTL_MS)
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))
