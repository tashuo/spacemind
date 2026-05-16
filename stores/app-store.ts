import { create } from 'zustand'
import type { Conversation, Message, PaletteKey, Space } from '@/lib/schema'
// 必须用 namespace 导入,而不是解构 —— 让测试用 vi.spyOn(db, 'putSpace') 能拦截到调用
import * as db from '@/lib/db'
import * as spacesLib from '@/lib/spaces'
import * as zipImport from '@/lib/zip-import'
import * as exportImport from '@/lib/export-import'

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

export interface JsonImportSummary {
  spacesAdded: number
  spacesUpdated: number
  conversationsAdded: number
  conversationsUpdated: number
  messagesAdded: number
}

export type SelectMode = 'toggle' | 'replace' | 'range'

interface State {
  loaded: boolean
  spaces: Space[]
  conversations: Conversation[]
  // 全文搜索需要正文 —— 启动时一次性 IDB 拉进来,后续导入/删除时同步维护。
  // 没搜索时 messages 是闲置成本(典型量级:几千~上万条,几 MB),换取搜索零延迟
  messages: Message[]
  importing: boolean
  toasts: Toast[]
  selectedConvIds: Set<string>
  // 跨空间搜索关键词。空串视为"未在搜索",此时 UI 走正常空间列表。
  // 真正的输入防抖在 SearchBar 组件里;这里始终拿到的是已防抖后的值,
  // 这样订阅者(主视图、命中数提示)不用在每次按键时重渲。
  searchQuery: string

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

  /** 把一个 space (或 unsorted)内的对话按 orderedIds 给定顺序重排。
   *  orderedIds 必须是该 space 当前可见的全部对话 id —— UI 算好新顺序后整组传下来。 */
  reorderConversations: (orderedIds: string[]) => Promise<void>

  toggleStar: (id: string) => Promise<void>
  addTag: (id: string, tag: string) => Promise<void>
  removeTag: (id: string, tag: string) => Promise<void>
  // undefined / 空串 → 删除 note 字段(不要写 note: undefined,违反 exactOptionalPropertyTypes)
  setConversationNote: (id: string, note: string | undefined) => Promise<void>

  selectConv: (id: string, mode: SelectMode, visibleIds?: string[]) => void
  clearSelection: () => void

  setSearchQuery: (q: string) => void

  importFromZip: (buf: ArrayBuffer) => Promise<ImportSummary>

  // SpaceMind 自家的 JSON 备份/恢复 —— 与 importFromZip 互不影响
  exportToJson: () => Promise<void>
  importFromJson: (file: File) => Promise<JsonImportSummary>

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
 * 通用的 conversation 字段乐观更新 + 回滚封装。
 * 和 mutateSpace 同一套套路:目标存在则跑 mutator,内存先改,IDB 后写,失败回滚 + 错误 toast。
 * mutator 返回 null 表示"算下来无需变更",静默退出 —— 避免无意义的 IDB 写和 re-render。
 */
async function mutateConversation(
  get: () => State,
  set: (partial: Partial<State>) => void,
  id: string,
  mutator: (current: Conversation, now: number) => Conversation | null,
  errorText: string,
): Promise<void> {
  const before = get().conversations
  const target = before.find((c) => c.id === id)
  if (!target) return
  const now = Date.now()
  const next = mutator(target, now)
  if (!next) return
  const nextList = before.map((c) => (c.id === id ? next : c))
  set({ conversations: nextList })
  try {
    await db.putConversation(next)
  } catch (e) {
    set({ conversations: before })
    get().pushToast('error', errorText)
    throw e
  }
}

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
  messages: [],
  importing: false,
  toasts: [],
  selectedConvIds: new Set<string>(),
  searchQuery: '',

  // load 失败不翻 loaded=true —— 保留给 UI 重试入口,不能伪装成"加载完毕但空"
  load: async () => {
    try {
      const [spaces, conversations, messages] = await Promise.all([
        db.allSpaces(),
        db.allConversations(),
        db.allMessages(),
      ])
      set({
        loaded: true,
        spaces: spacesLib.sortedForDisplay(spaces),
        conversations,
        messages,
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

  reorderConversations: async (orderedIds) => {
    if (orderedIds.length === 0) return
    const before = get().conversations
    const indexById = new Map<string, number>()
    orderedIds.forEach((id, i) => indexById.set(id, i))
    // 只对 orderedIds 里的对话改写 sortIndex,其它对话保持原样;
    // 已存在的对话若新旧 sortIndex 一致也照写一份(O(n) 内存替换,IDB 那一层会跳过没变的)
    const nextList = before.map((c) => {
      const i = indexById.get(c.id)
      if (i === undefined) return c
      if (c.sortIndex === i) return c
      return { ...c, sortIndex: i }
    })
    set({ conversations: nextList })
    try {
      await db.bulkUpdateConversationOrder(orderedIds)
    } catch (e) {
      set({ conversations: before })
      get().pushToast('error', 'Failed to reorder conversations')
      throw e
    }
  },

  toggleStar: async (id) => {
    await mutateConversation(
      get,
      set,
      id,
      (current, now) => ({ ...current, starred: !current.starred, platformUpdatedAt: now }),
      'Failed to toggle star',
    )
  },

  // 重复 tag 静默吞掉:返回 null 让 mutateConversation 不做事,避免无意义的写盘。
  // tag 内部小写做去重 key,但写入保留用户原始大小写
  addTag: async (id, tag) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    await mutateConversation(
      get,
      set,
      id,
      (current, now) => {
        const lower = trimmed.toLowerCase()
        if (current.tags.some((t) => t.toLowerCase() === lower)) return null
        return { ...current, tags: [...current.tags, trimmed], platformUpdatedAt: now }
      },
      'Failed to add tag',
    )
  },

  removeTag: async (id, tag) => {
    await mutateConversation(
      get,
      set,
      id,
      (current, now) => {
        const lower = tag.toLowerCase()
        const next = current.tags.filter((t) => t.toLowerCase() !== lower)
        if (next.length === current.tags.length) return null
        return { ...current, tags: next, platformUpdatedAt: now }
      },
      'Failed to remove tag',
    )
  },

  setConversationNote: async (id, note) => {
    await mutateConversation(
      get,
      set,
      id,
      (current, now) => {
        const trimmed = note?.trim()
        if (!trimmed) {
          // 删除 note 字段:解构丢弃,避免 exactOptionalPropertyTypes 下显式 undefined
          if (current.note === undefined) return null
          const { note: _drop, ...rest } = current
          void _drop
          return { ...rest, platformUpdatedAt: now }
        }
        if (current.note === trimmed) return null
        return { ...current, note: trimmed, platformUpdatedAt: now }
      },
      'Failed to update note',
    )
  },

  removeConversations: async (ids) => {
    if (ids.length === 0) return
    const before = get().conversations
    const beforeMessages = get().messages
    const beforeSelection = get().selectedConvIds
    const idSet = new Set(ids)
    const nextList = before.filter((c) => !idSet.has(c.id))
    // db.deleteConversationsCascade 会级联删 messages 行,store 里也得过滤掉,
    // 否则下一次 search 索引重建仍会塞进孤儿 message,匹配出来的 conversation 已不存在
    const nextMessages = beforeMessages.filter((m) => !idSet.has(m.conversationId))
    // 选中态里若包含被删 id,同步剔除 —— 否则 UI 顶部"X selected"计数会失真
    const nextSelection = new Set<string>()
    for (const id of beforeSelection) {
      if (!idSet.has(id)) nextSelection.add(id)
    }
    set({ conversations: nextList, messages: nextMessages, selectedConvIds: nextSelection })
    try {
      await db.deleteConversationsCascade(ids)
    } catch (e) {
      set({ conversations: before, messages: beforeMessages, selectedConvIds: beforeSelection })
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

  // 纯内存切换;持久化不需要 —— 搜索关键词是会话期状态,刷新页面应该回到空白
  setSearchQuery: (q) => set({ searchQuery: q }),

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

      const [conversations, messages] = await Promise.all([
        db.allConversations(),
        db.allMessages(),
      ])
      set({ conversations, messages, importing: false })

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

  // 把当前内存 + IDB 中的全部 messages 序列化成 JSON 文件,触发浏览器下载。
  // 失败时推 error toast 并抛,UI 可以决定是否提示用户重试。
  exportToJson: async () => {
    try {
      // 三类对象都从内存读 —— load 之后是权威副本,避免和 IDB 二次读不一致
      const { spaces, conversations, messages } = get()
      const now = Date.now()
      const content = exportImport.serializeForExport(
        { spaces, conversations, messages },
        now,
      )
      exportImport.downloadJson(exportImport.exportFilename(now), content)
      get().pushToast('info', 'Backup downloaded')
    } catch (e) {
      get().pushToast('error', 'Export failed')
      throw e
    }
  },

  // 解析 → 三类对象 upsert(保留用户元数据)→ 重读内存。
  // messages 默认覆盖:同 id 视为同一条 message 的最新副本,SpaceMind 不在本地编辑 message 内容
  importFromJson: async (file) => {
    let text: string
    try {
      text = await file.text()
    } catch (e) {
      get().pushToast('error', 'Failed to read file')
      throw e
    }
    const parsed = exportImport.parseImport(text)
    if (!parsed.ok) {
      const reason = parsed.reason === 'invalid-json' ? 'Invalid JSON file' : 'Unrecognized backup format'
      get().pushToast('error', reason)
      throw new Error(reason)
    }
    const { spaces: incomingSpaces, conversations: incomingConvs, messages: incomingMessages } = parsed.file

    let spacesAdded = 0
    let spacesUpdated = 0
    const mergedSpaces: Space[] = []
    for (const incoming of incomingSpaces) {
      const existing = await db.getSpace(incoming.id)
      mergedSpaces.push(exportImport.mergeSpace(existing, incoming))
      if (existing) spacesUpdated++
      else spacesAdded++
    }

    let conversationsAdded = 0
    let conversationsUpdated = 0
    const mergedConvs: Conversation[] = []
    for (const incoming of incomingConvs) {
      const existing = await db.getConversation(incoming.id)
      mergedConvs.push(exportImport.mergeConversation(existing, incoming))
      if (existing) conversationsUpdated++
      else conversationsAdded++
    }

    try {
      // Space 没有批量写接口,串行 putSpace —— 数量级一般 < 100,无需优化
      for (const s of mergedSpaces) await db.putSpace(s)
      await db.bulkPutConversations(mergedConvs)
      await db.bulkPutMessages(incomingMessages)
    } catch (e) {
      get().pushToast('error', 'Failed to write imported data')
      throw e
    }

    // 重新拉一遍,避免本地内存与库不一致(尤其 spaces 的 by-updatedAt 顺序)
    const [spaces, conversations, messages] = await Promise.all([
      db.allSpaces(),
      db.allConversations(),
      db.allMessages(),
    ])
    set({
      spaces: spacesLib.sortedForDisplay(spaces),
      conversations,
      messages,
    })

    const total =
      spacesAdded +
      spacesUpdated +
      conversationsAdded +
      conversationsUpdated +
      incomingMessages.length
    get().pushToast('info', `Imported ${total} items`)

    return {
      spacesAdded,
      spacesUpdated,
      conversationsAdded,
      conversationsUpdated,
      messagesAdded: incomingMessages.length,
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
