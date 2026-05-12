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

export type SelectMode = 'toggle' | 'replace' | 'range'

interface State {
  loaded: boolean
  spaces: Space[]
  conversations: Conversation[]
  importing: boolean
  toasts: Toast[]
  selectedConvIds: Set<string>

  load: () => Promise<void>
  createSpace: (name: string, color: PaletteKey) => Promise<string>
  renameSpace: (id: string, name: string) => Promise<void>
  removeSpace: (id: string) => Promise<void>

  setEmoji: (id: string, emoji: string | undefined) => Promise<void>
  setNote: (id: string, note: string | undefined) => Promise<void>
  togglePin: (id: string) => Promise<void>
  setSortIndex: (id: string, sortIndex: number) => Promise<void>

  moveConversationToSpace: (
    conversationId: string,
    spaceId: string | null
  ) => Promise<void>
  moveConversationsToSpace: (
    ids: string[],
    spaceId: string | null
  ) => Promise<void>
  removeConversations: (ids: string[]) => Promise<void>

  selectConv: (id: string, mode: SelectMode, visibleIds?: string[]) => void
  clearSelection: () => void

  importFromZip: (buf: ArrayBuffer) => Promise<ImportSummary>

  pushToast: (kind: ToastKind, text: string) => void
  dismissToast: (id: number) => void
}

// 模块级单调 id —— 同一进程内不会重复;Service Worker 重启不影响,toast 本身不持久化
let toastSeq = 0

/** Toast 自动消失时长。集中常量,便于将来调参或换成可配置 */
const TOAST_TTL_MS = 4000

// 多选锚点:'range' 模式下用来确定区间起点。
// 放模块级而不是 state,是因为 anchor 只在交互瞬间有意义,不需要订阅其变化,
// 也不需要进入 React 渲染依赖图;放 state 会触发不必要的 re-render。
let anchorConvId: string | null = null

/**
 * 通用的 space 字段乐观更新 + 回滚封装。
 * 把 setEmoji / setNote / togglePin / setSortIndex 共有的 5 步写一次:
 *   1) 找到现存 Space  2) 用 mutator 算新值  3) 乐观写内存(并 re-sort)
 *   4) await db.putSpace  5) 失败回滚 + 错误 toast
 * mutator 返回 null 表示"不需要变更",静默退出(togglePin 不会用到,但保留扩展性)
 */
async function mutateSpace(
  get: () => State,
  set: (partial: Partial<State>) => void,
  id: string,
  mutator: (current: Space, now: number) => Space | null,
  errorText: string
): Promise<void> {
  const before = get().spaces
  const target = before.find((s) => s.id === id)
  if (!target) return
  const now = Date.now()
  const next = mutator(target, now)
  if (!next) return
  const nextList = before.map((s) => (s.id === id ? next : s))
  set({ spaces: spacesLib.sortedForDisplay(nextList) })
  try {
    await db.putSpace(next)
  } catch (e) {
    set({ spaces: before })
    get().pushToast('error', errorText)
    throw e
  }
}

export const useAppStore = create<State>((set, get) => ({
  loaded: false,
  spaces: [],
  conversations: [],
  importing: false,
  toasts: [],
  selectedConvIds: new Set<string>(),

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

  setEmoji: async (id, emoji) => {
    await mutateSpace(
      get,
      set,
      id,
      (current, now) => spacesLib.setEmoji(current, emoji, now),
      'Failed to update emoji'
    )
  },

  setNote: async (id, note) => {
    await mutateSpace(
      get,
      set,
      id,
      (current, now) => spacesLib.setNote(current, note, now),
      'Failed to update note'
    )
  },

  togglePin: async (id) => {
    await mutateSpace(
      get,
      set,
      id,
      (current, now) => spacesLib.setPinned(current, !current.pinned, now),
      'Failed to toggle pin'
    )
  },

  setSortIndex: async (id, sortIndex) => {
    await mutateSpace(
      get,
      set,
      id,
      (current, now) => spacesLib.setSortIndex(current, sortIndex, now),
      'Failed to reorder space'
    )
  },

  moveConversationToSpace: async (conversationId, spaceId) => {
    const before = get().conversations
    const target = before.find((c) => c.id === conversationId)
    if (!target) return
    const now = Date.now()
    let next: Conversation
    if (spaceId === null) {
      // exactOptionalPropertyTypes:解构丢字段,避免显式 spaceId: undefined
      const { spaceId: _drop, ...rest } = target
      void _drop
      next = { ...rest, platformUpdatedAt: now }
    } else {
      next = { ...target, spaceId, platformUpdatedAt: now }
    }
    const nextList = before.map((c) => (c.id === conversationId ? next : c))
    set({ conversations: nextList })
    try {
      await db.putConversation(next)
    } catch (e) {
      set({ conversations: before })
      get().pushToast('error', 'Failed to move conversation')
      throw e
    }
  },

  moveConversationsToSpace: async (ids, spaceId) => {
    if (ids.length === 0) return
    const before = get().conversations
    const idSet = new Set(ids)
    const now = Date.now()
    const nextList = before.map((c) => {
      if (!idSet.has(c.id)) return c
      if (spaceId === null) {
        const { spaceId: _drop, ...rest } = c
        void _drop
        return { ...rest, platformUpdatedAt: now }
      }
      return { ...c, spaceId, platformUpdatedAt: now }
    })
    set({ conversations: nextList })
    try {
      await db.bulkUpdateConversationSpace(ids, spaceId, now)
    } catch (e) {
      set({ conversations: before })
      get().pushToast('error', 'Failed to move conversations')
      throw e
    }
  },

  removeConversations: async (ids) => {
    if (ids.length === 0) return
    const before = get().conversations
    const beforeSelection = get().selectedConvIds
    const idSet = new Set(ids)
    const nextList = before.filter((c) => !idSet.has(c.id))
    // 选中态里若包含被删 id,同步剔除 —— 否则 UI 顶部"X selected"计数会失真
    const nextSelection = new Set<string>()
    for (const id of beforeSelection) {
      if (!idSet.has(id)) nextSelection.add(id)
    }
    set({ conversations: nextList, selectedConvIds: nextSelection })
    try {
      await db.deleteConversationsCascade(ids)
    } catch (e) {
      set({ conversations: before, selectedConvIds: beforeSelection })
      get().pushToast('error', 'Failed to delete conversations')
      throw e
    }
  },

  selectConv: (id, mode, visibleIds) => {
    const current = get().selectedConvIds
    if (mode === 'replace') {
      anchorConvId = id
      set({ selectedConvIds: new Set([id]) })
      return
    }
    if (mode === 'toggle') {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      anchorConvId = id
      set({ selectedConvIds: next })
      return
    }
    // 'range':需要 anchor + visibleIds 才能算出区间;缺任意一个就退化成 replace
    if (!anchorConvId || !visibleIds || visibleIds.length === 0) {
      anchorConvId = id
      set({ selectedConvIds: new Set([id]) })
      return
    }
    const fromIdx = visibleIds.indexOf(anchorConvId)
    const toIdx = visibleIds.indexOf(id)
    if (fromIdx === -1 || toIdx === -1) {
      // anchor 或目标 id 不在当前可见列表里(如已过滤掉)—— 同样退化
      anchorConvId = id
      set({ selectedConvIds: new Set([id]) })
      return
    }
    const lo = Math.min(fromIdx, toIdx)
    const hi = Math.max(fromIdx, toIdx)
    const slice = visibleIds.slice(lo, hi + 1)
    // 'range' 操作不更新 anchor:连续多次 shift+click 应都基于同一个起点
    set({ selectedConvIds: new Set(slice) })
  },

  clearSelection: () => {
    anchorConvId = null
    set({ selectedConvIds: new Set() })
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
