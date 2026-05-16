import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { useAppStore } from '@/stores/app-store'
import * as db from '@/lib/db'
import type { Conversation } from '@/lib/schema'

// 每个 case 前清库 + 重置 store —— 避免 idb 拿着旧句柄、store 残留上一个 case 的 spaces。
// 先 close 老连接再 deleteDatabase,否则 fake-indexeddb 会卡在 versionchange。
beforeEach(async () => {
  await db.__resetForTest()
  await indexedDB.deleteDatabase('spacemind')
  useAppStore.setState({
    loaded: false,
    spaces: [],
    conversations: [],
    messages: [],
    activeTagFilter: new Set(),
    toasts: [],
    selectedConvIds: new Set(),
  })
  // anchorConvId 是模块级状态,setState 接触不到 —— 必须显式调用 clearSelection 把它清掉
  useAppStore.getState().clearSelection()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('app-store.load', () => {
  it('flips loaded=true and reads empty spaces from IDB', async () => {
    await useAppStore.getState().load()
    expect(useAppStore.getState().loaded).toBe(true)
    expect(useAppStore.getState().spaces).toEqual([])
  })

  it('reads previously written spaces into state, sorted', async () => {
    await db.putSpace({
      id: 'a',
      name: 'Alpha',
      color: 'indigo',
      createdAt: 1,
      updatedAt: 100,
    })
    await db.putSpace({
      id: 'b',
      name: 'Beta',
      color: 'emerald',
      createdAt: 2,
      updatedAt: 200,
    })
    await useAppStore.getState().load()
    expect(useAppStore.getState().loaded).toBe(true)
    // updatedAt 降序兜底 → b 在前
    expect(useAppStore.getState().spaces.map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('on read failure: keeps loaded=false and pushes an error toast', async () => {
    vi.spyOn(db, 'allSpaces').mockRejectedValueOnce(new Error('boom'))
    await useAppStore.getState().load()
    // load 失败不回滚状态,但也不应当假装加载完毕 —— UI 才有机会重试
    expect(useAppStore.getState().loaded).toBe(false)
    expect(useAppStore.getState().toasts).toHaveLength(1)
    expect(useAppStore.getState().toasts[0]?.kind).toBe('error')
  })
})

describe('app-store.createSpace', () => {
  it('optimistically adds and returns the new id', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(useAppStore.getState().spaces.map((s) => s.name)).toEqual(['Work'])
  })

  it('persists across loads', async () => {
    await useAppStore.getState().load()
    await useAppStore.getState().createSpace('Work', 'indigo')
    // 模拟下一次冷启动:清掉 store 内存,重新从 IDB 读
    useAppStore.setState({ loaded: false, spaces: [] })
    await useAppStore.getState().load()
    expect(useAppStore.getState().spaces.map((s) => s.name)).toEqual(['Work'])
  })

  it('rolls back optimistic add if IDB write fails', async () => {
    await useAppStore.getState().load()
    vi.spyOn(db, 'putSpace').mockRejectedValueOnce(new Error('disk full'))

    await expect(
      useAppStore.getState().createSpace('Work', 'indigo')
    ).rejects.toThrow()

    // 乐观插入必须被回滚 —— UI 不能留下一个"幽灵 space"
    expect(useAppStore.getState().spaces).toEqual([])
    expect(useAppStore.getState().toasts).toHaveLength(1)
    expect(useAppStore.getState().toasts[0]?.kind).toBe('error')
  })
})

describe('app-store.renameSpace', () => {
  it('renames an existing space and bumps updatedAt', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Old', 'indigo')
    const beforeUpdatedAt = useAppStore.getState().spaces[0]!.updatedAt

    // 拉开时钟,确保 updatedAt 一定向前推进
    await new Promise((r) => setTimeout(r, 2))

    await useAppStore.getState().renameSpace(id, 'New')
    const renamed = useAppStore.getState().spaces.find((s) => s.id === id)
    expect(renamed?.name).toBe('New')
    expect(renamed?.updatedAt).toBeGreaterThanOrEqual(beforeUpdatedAt)
  })

  it('is a no-op when the id is unknown (no throw, no state change)', async () => {
    await useAppStore.getState().load()
    await useAppStore.getState().renameSpace('does-not-exist', 'whatever')
    expect(useAppStore.getState().spaces).toEqual([])
  })

  it('rolls back if IDB write fails', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Old', 'indigo')
    const snapshot = useAppStore.getState().spaces

    vi.spyOn(db, 'putSpace').mockRejectedValueOnce(new Error('boom'))
    await expect(
      useAppStore.getState().renameSpace(id, 'New')
    ).rejects.toThrow()

    expect(useAppStore.getState().spaces).toEqual(snapshot)
  })
})

describe('app-store.removeSpace', () => {
  it('removes the space from state and IDB', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    expect(useAppStore.getState().spaces).toHaveLength(1)

    await useAppStore.getState().removeSpace(id)
    expect(useAppStore.getState().spaces).toEqual([])

    // IDB 也要清干净 —— 下次 load 不应再看到它
    useAppStore.setState({ loaded: false, spaces: [] })
    await useAppStore.getState().load()
    expect(useAppStore.getState().spaces).toEqual([])
  })

  it('rolls back if IDB delete fails', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    const snapshot = useAppStore.getState().spaces

    vi.spyOn(db, 'deleteSpace').mockRejectedValueOnce(new Error('boom'))
    await expect(useAppStore.getState().removeSpace(id)).rejects.toThrow()

    expect(useAppStore.getState().spaces).toEqual(snapshot)
  })
})

describe('app-store.pushToast / dismissToast', () => {
  it('pushToast adds a toast with monotonically increasing id', () => {
    useAppStore.getState().pushToast('info', 'one')
    useAppStore.getState().pushToast('error', 'two')
    const toasts = useAppStore.getState().toasts
    expect(toasts).toHaveLength(2)
    expect(toasts[0]?.text).toBe('one')
    expect(toasts[1]?.text).toBe('two')
    expect(toasts[1]!.id).toBeGreaterThan(toasts[0]!.id)
  })

  it('dismissToast removes a toast by id', () => {
    useAppStore.getState().pushToast('info', 'keep')
    useAppStore.getState().pushToast('error', 'drop')
    const dropId = useAppStore.getState().toasts[1]!.id
    useAppStore.getState().dismissToast(dropId)
    expect(useAppStore.getState().toasts.map((t) => t.text)).toEqual(['keep'])
  })

  it('pushToast auto-dismisses after 4 seconds', () => {
    vi.useFakeTimers()
    useAppStore.getState().pushToast('info', 'temporary')
    expect(useAppStore.getState().toasts).toHaveLength(1)

    vi.advanceTimersByTime(3999)
    expect(useAppStore.getState().toasts).toHaveLength(1)

    vi.advanceTimersByTime(2)
    expect(useAppStore.getState().toasts).toHaveLength(0)
  })
})

// 测试夹具:批量造 conversation,直接写入 IDB 并刷到 store 状态,贴近真实路径
const mkConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'c1',
  platform: 'chatgpt',
  url: 'https://chatgpt.com/c/c1',
  title: 'Test',
  tags: [],
  starred: false,
  capturedAt: 0,
  ...overrides,
})

async function seedConversations(rows: Conversation[]): Promise<void> {
  for (const r of rows) await db.putConversation(r)
  useAppStore.setState({ conversations: rows })
}

describe('app-store.setEmoji', () => {
  it('sets emoji on an existing space and persists', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    await useAppStore.getState().setEmoji(id, '🚀')
    expect(useAppStore.getState().spaces.find((s) => s.id === id)?.emoji).toBe('🚀')
    const fromDb = await db.getSpace(id)
    expect(fromDb?.emoji).toBe('🚀')
  })

  it('clears emoji when given empty string', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    await useAppStore.getState().setEmoji(id, '🚀')
    await useAppStore.getState().setEmoji(id, '')
    const s = useAppStore.getState().spaces.find((sp) => sp.id === id)
    expect(s?.emoji).toBeUndefined()
  })

  it('clears emoji when given undefined', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    await useAppStore.getState().setEmoji(id, '🎯')
    await useAppStore.getState().setEmoji(id, undefined)
    const s = useAppStore.getState().spaces.find((sp) => sp.id === id)
    expect(s?.emoji).toBeUndefined()
  })

  it('is a no-op when id is unknown', async () => {
    await useAppStore.getState().load()
    await useAppStore.getState().setEmoji('ghost', '🚀')
    expect(useAppStore.getState().spaces).toEqual([])
  })

  it('rolls back on IDB failure', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    const snapshot = useAppStore.getState().spaces
    vi.spyOn(db, 'putSpace').mockRejectedValueOnce(new Error('boom'))
    await expect(useAppStore.getState().setEmoji(id, '🚀')).rejects.toThrow()
    expect(useAppStore.getState().spaces).toEqual(snapshot)
  })
})

describe('app-store.setNote', () => {
  it('sets note and clears it with empty string', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    await useAppStore.getState().setNote(id, 'remember this')
    expect(useAppStore.getState().spaces.find((s) => s.id === id)?.note).toBe(
      'remember this'
    )
    await useAppStore.getState().setNote(id, '')
    expect(useAppStore.getState().spaces.find((s) => s.id === id)?.note).toBeUndefined()
  })
})

describe('app-store.togglePin', () => {
  it('flips pin state and bumps updatedAt', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    const before = useAppStore.getState().spaces.find((s) => s.id === id)!
    expect(before.pinned).toBeUndefined()

    await new Promise((r) => setTimeout(r, 2))
    await useAppStore.getState().togglePin(id)
    const afterPin = useAppStore.getState().spaces.find((s) => s.id === id)!
    expect(afterPin.pinned).toBe(true)
    expect(afterPin.updatedAt).toBeGreaterThanOrEqual(before.updatedAt)

    await useAppStore.getState().togglePin(id)
    const unpinned = useAppStore.getState().spaces.find((s) => s.id === id)!
    expect(unpinned.pinned).toBeUndefined()
  })

  it('pinned spaces sort to the top in state', async () => {
    await useAppStore.getState().load()
    const a = await useAppStore.getState().createSpace('A', 'indigo')
    await useAppStore.getState().createSpace('B', 'emerald')
    // B 是最近创建,默认排在最前;给 A 加 pin 后应翻到顶部
    await useAppStore.getState().togglePin(a)
    expect(useAppStore.getState().spaces[0]?.id).toBe(a)
  })
})

describe('app-store.setSortIndex', () => {
  it('updates sortIndex and persists', async () => {
    await useAppStore.getState().load()
    const a = await useAppStore.getState().createSpace('A', 'indigo')
    const b = await useAppStore.getState().createSpace('B', 'emerald')
    await useAppStore.getState().setSortIndex(a, 1)
    await useAppStore.getState().setSortIndex(b, 0)
    // 排序后 b 在前(sortIndex 0 < 1)
    expect(useAppStore.getState().spaces.map((s) => s.id)).toEqual([b, a])
  })
})

describe('app-store.moveConversationToSpace', () => {
  it('moves a conversation to a specific space (state + IDB)', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    await useAppStore.getState().moveConversationToSpace('c1', 's1')
    expect(
      useAppStore.getState().conversations.find((c) => c.id === 'c1')?.spaceId
    ).toBe('s1')
    expect((await db.getConversation('c1'))?.spaceId).toBe('s1')
  })

  it('removes spaceId when called with null (not stored as undefined)', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1', spaceId: 's1' })])
    await useAppStore.getState().moveConversationToSpace('c1', null)
    const inState = useAppStore.getState().conversations.find((c) => c.id === 'c1')!
    expect('spaceId' in inState).toBe(false)
    const inDb = (await db.getConversation('c1'))!
    expect('spaceId' in inDb).toBe(false)
  })

  it('is a no-op when conversation id is unknown', async () => {
    await useAppStore.getState().load()
    await useAppStore.getState().moveConversationToSpace('ghost', 's1')
    expect(useAppStore.getState().conversations).toEqual([])
  })

  it('rolls back on IDB failure', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    const snapshot = useAppStore.getState().conversations
    vi.spyOn(db, 'putConversation').mockRejectedValueOnce(new Error('boom'))
    await expect(
      useAppStore.getState().moveConversationToSpace('c1', 's1')
    ).rejects.toThrow()
    expect(useAppStore.getState().conversations).toEqual(snapshot)
  })
})

describe('app-store.moveConversationsToSpace', () => {
  it('moves all listed conversations in one batch', async () => {
    await useAppStore.getState().load()
    await seedConversations([
      mkConversation({ id: 'c1', url: 'https://chatgpt.com/c/c1' }),
      mkConversation({ id: 'c2', url: 'https://chatgpt.com/c/c2' }),
      mkConversation({ id: 'c3', url: 'https://chatgpt.com/c/c3' }),
    ])
    await useAppStore.getState().moveConversationsToSpace(['c1', 'c2'], 's1')
    const byId = (id: string) =>
      useAppStore.getState().conversations.find((c) => c.id === id)
    expect(byId('c1')?.spaceId).toBe('s1')
    expect(byId('c2')?.spaceId).toBe('s1')
    expect(byId('c3')?.spaceId).toBeUndefined()
    expect((await db.getConversation('c1'))?.spaceId).toBe('s1')
    expect((await db.getConversation('c2'))?.spaceId).toBe('s1')
  })

  it('null spaceId removes the field in state and IDB', async () => {
    await useAppStore.getState().load()
    await seedConversations([
      mkConversation({ id: 'c1', spaceId: 's1' }),
      mkConversation({ id: 'c2', spaceId: 's1', url: 'https://chatgpt.com/c/c2' }),
    ])
    await useAppStore.getState().moveConversationsToSpace(['c1', 'c2'], null)
    const c1 = useAppStore.getState().conversations.find((c) => c.id === 'c1')!
    expect('spaceId' in c1).toBe(false)
    const inDb = (await db.getConversation('c2'))!
    expect('spaceId' in inDb).toBe(false)
  })

  it('empty ids is a no-op', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    await useAppStore.getState().moveConversationsToSpace([], 's1')
    expect(
      useAppStore.getState().conversations.find((c) => c.id === 'c1')?.spaceId
    ).toBeUndefined()
  })
})

describe('app-store.toggleTagFilter / clearTagFilter', () => {
  it('adds and removes tag (lower-case key)', () => {
    useAppStore.getState().toggleTagFilter('Work')
    expect(Array.from(useAppStore.getState().activeTagFilter)).toEqual(['work'])
    // 再 toggle 同一 tag 应当移除(大小写不敏感)
    useAppStore.getState().toggleTagFilter('WORK')
    expect(Array.from(useAppStore.getState().activeTagFilter)).toEqual([])
  })

  it('AND semantics: multiple tags accumulate', () => {
    useAppStore.getState().toggleTagFilter('a')
    useAppStore.getState().toggleTagFilter('b')
    expect(useAppStore.getState().activeTagFilter.size).toBe(2)
  })

  it('whitespace-only tag is ignored', () => {
    useAppStore.getState().toggleTagFilter('   ')
    expect(useAppStore.getState().activeTagFilter.size).toBe(0)
  })

  it('clearTagFilter empties the set', () => {
    useAppStore.getState().toggleTagFilter('a')
    useAppStore.getState().toggleTagFilter('b')
    useAppStore.getState().clearTagFilter()
    expect(useAppStore.getState().activeTagFilter.size).toBe(0)
  })
})

describe('app-store.removeConversations undo', () => {
  it('pushes a toast with Undo action that restores deleted rows', async () => {
    await useAppStore.getState().load()
    await seedConversations([
      mkConversation({ id: 'c1', url: 'https://chatgpt.com/c/c1' }),
      mkConversation({ id: 'c2', url: 'https://chatgpt.com/c/c2' }),
    ])
    await db.bulkPutMessages([
      { id: 'm1', conversationId: 'c1', role: 'user', content: 'a', timestamp: 0 },
    ])
    useAppStore.setState({
      messages: [{ id: 'm1', conversationId: 'c1', role: 'user', content: 'a', timestamp: 0 }],
    })

    await useAppStore.getState().removeConversations(['c1'])

    // 删除后 state 里少了 c1
    expect(useAppStore.getState().conversations.map((c) => c.id)).toEqual(['c2'])
    // 出现一个带 Undo action 的 toast
    const toasts = useAppStore.getState().toasts
    expect(toasts.length).toBeGreaterThan(0)
    const undoToast = toasts.find((t) => t.action?.label === 'Undo')
    expect(undoToast).toBeDefined()

    // 触发 Undo
    undoToast!.action!.onAction()
    // 等异步 restore 完成
    await new Promise((r) => setTimeout(r, 50))

    expect(useAppStore.getState().conversations.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
    expect(useAppStore.getState().messages.map((m) => m.id)).toEqual(['m1'])
    // IDB 也复原了
    expect(await db.getConversation('c1')).toBeDefined()
    expect((await db.messagesForConversation('c1')).map((m) => m.id)).toEqual(['m1'])
  })
})

describe('app-store messages state', () => {
  it('loads messages alongside conversations on load()', async () => {
    await db.putConversation({
      id: 'c1',
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/c1',
      title: 'T',
      tags: [],
      starred: false,
      capturedAt: 0,
    })
    await db.bulkPutMessages([
      { id: 'm1', conversationId: 'c1', role: 'user', content: 'hello world', timestamp: 0 },
    ])
    await useAppStore.getState().load()
    expect(useAppStore.getState().messages.map((m) => m.id)).toEqual(['m1'])
  })

  it('drops messages of deleted conversations from state', async () => {
    await useAppStore.getState().load()
    await seedConversations([
      mkConversation({ id: 'c1' }),
      mkConversation({ id: 'c2', url: 'https://chatgpt.com/c/c2' }),
    ])
    await db.bulkPutMessages([
      { id: 'm1', conversationId: 'c1', role: 'user', content: 'a', timestamp: 0 },
      { id: 'm2', conversationId: 'c2', role: 'user', content: 'b', timestamp: 0 },
    ])
    useAppStore.setState({
      messages: [
        { id: 'm1', conversationId: 'c1', role: 'user', content: 'a', timestamp: 0 },
        { id: 'm2', conversationId: 'c2', role: 'user', content: 'b', timestamp: 0 },
      ],
    })
    await useAppStore.getState().removeConversations(['c1'])
    expect(useAppStore.getState().messages.map((m) => m.id)).toEqual(['m2'])
  })
})

describe('app-store.removeConversations', () => {
  it('removes from state, IDB rows, and cascades messages', async () => {
    await useAppStore.getState().load()
    await seedConversations([
      mkConversation({ id: 'c1', url: 'https://chatgpt.com/c/c1' }),
      mkConversation({ id: 'c2', url: 'https://chatgpt.com/c/c2' }),
    ])
    await db.bulkPutMessages([
      {
        id: 'm1',
        conversationId: 'c1',
        role: 'user',
        content: 'hi',
        timestamp: 0,
      },
      {
        id: 'm2',
        conversationId: 'c2',
        role: 'user',
        content: 'hey',
        timestamp: 0,
      },
    ])

    await useAppStore.getState().removeConversations(['c1'])

    expect(useAppStore.getState().conversations.map((c) => c.id)).toEqual(['c2'])
    expect(await db.getConversation('c1')).toBeUndefined()
    expect(await db.messagesForConversation('c1')).toEqual([])
    // c2 不受影响
    expect((await db.messagesForConversation('c2')).map((m) => m.id)).toEqual(['m2'])
  })

  it('also drops the removed ids from selectedConvIds', async () => {
    await useAppStore.getState().load()
    await seedConversations([
      mkConversation({ id: 'c1' }),
      mkConversation({ id: 'c2', url: 'https://chatgpt.com/c/c2' }),
    ])
    useAppStore.setState({ selectedConvIds: new Set(['c1', 'c2']) })
    await useAppStore.getState().removeConversations(['c1'])
    expect(Array.from(useAppStore.getState().selectedConvIds)).toEqual(['c2'])
  })

  it('empty ids is a no-op', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    await useAppStore.getState().removeConversations([])
    expect(useAppStore.getState().conversations.map((c) => c.id)).toEqual(['c1'])
  })
})

describe('app-store.reorderConversations', () => {
  it('writes sortIndex by position for each id', async () => {
    await useAppStore.getState().load()
    await seedConversations([
      mkConversation({ id: 'c1', url: 'https://chatgpt.com/c/c1' }),
      mkConversation({ id: 'c2', url: 'https://chatgpt.com/c/c2' }),
      mkConversation({ id: 'c3', url: 'https://chatgpt.com/c/c3' }),
    ])
    await useAppStore.getState().reorderConversations(['c3', 'c1', 'c2'])
    const all = useAppStore.getState().conversations
    expect(all.find((c) => c.id === 'c3')?.sortIndex).toBe(0)
    expect(all.find((c) => c.id === 'c1')?.sortIndex).toBe(1)
    expect(all.find((c) => c.id === 'c2')?.sortIndex).toBe(2)
    // 持久化也对得上
    expect((await db.getConversation('c3'))?.sortIndex).toBe(0)
    expect((await db.getConversation('c1'))?.sortIndex).toBe(1)
    expect((await db.getConversation('c2'))?.sortIndex).toBe(2)
  })

  it('empty list is a no-op (no IDB write)', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    const spy = vi.spyOn(db, 'bulkUpdateConversationOrder')
    await useAppStore.getState().reorderConversations([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('rolls back state on IDB failure', async () => {
    await useAppStore.getState().load()
    await seedConversations([
      mkConversation({ id: 'c1' }),
      mkConversation({ id: 'c2', url: 'https://chatgpt.com/c/c2' }),
    ])
    const snapshot = useAppStore.getState().conversations
    vi.spyOn(db, 'bulkUpdateConversationOrder').mockRejectedValueOnce(new Error('boom'))
    await expect(useAppStore.getState().reorderConversations(['c2', 'c1'])).rejects.toThrow()
    expect(useAppStore.getState().conversations).toEqual(snapshot)
  })
})

describe('app-store.toggleStar', () => {
  it('flips starred and persists', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    await useAppStore.getState().toggleStar('c1')
    expect(useAppStore.getState().conversations.find((c) => c.id === 'c1')?.starred).toBe(true)
    expect((await db.getConversation('c1'))?.starred).toBe(true)
    await useAppStore.getState().toggleStar('c1')
    expect(useAppStore.getState().conversations.find((c) => c.id === 'c1')?.starred).toBe(false)
  })

  it('is a no-op when id is unknown', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    await useAppStore.getState().toggleStar('ghost')
    expect(useAppStore.getState().conversations.find((c) => c.id === 'c1')?.starred).toBe(false)
  })

  it('rolls back on IDB failure', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    const snapshot = useAppStore.getState().conversations
    vi.spyOn(db, 'putConversation').mockRejectedValueOnce(new Error('boom'))
    await expect(useAppStore.getState().toggleStar('c1')).rejects.toThrow()
    expect(useAppStore.getState().conversations).toEqual(snapshot)
  })
})

describe('app-store.addTag / removeTag', () => {
  it('adds a new tag and trims whitespace', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    await useAppStore.getState().addTag('c1', '  Work  ')
    expect(useAppStore.getState().conversations.find((c) => c.id === 'c1')?.tags).toEqual(['Work'])
  })

  it('dedupes case-insensitively without bumping IDB', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1', tags: ['Work'] })])
    const spy = vi.spyOn(db, 'putConversation')
    await useAppStore.getState().addTag('c1', 'work')
    expect(useAppStore.getState().conversations.find((c) => c.id === 'c1')?.tags).toEqual(['Work'])
    expect(spy).not.toHaveBeenCalled()
  })

  it('removes existing tag case-insensitively', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1', tags: ['Work', 'Personal'] })])
    await useAppStore.getState().removeTag('c1', 'WORK')
    expect(useAppStore.getState().conversations.find((c) => c.id === 'c1')?.tags).toEqual(['Personal'])
  })

  it('removeTag is a no-op when the tag is absent', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1', tags: ['Work'] })])
    const spy = vi.spyOn(db, 'putConversation')
    await useAppStore.getState().removeTag('c1', 'Personal')
    expect(spy).not.toHaveBeenCalled()
  })

  it('addTag with empty/whitespace is a no-op', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    const spy = vi.spyOn(db, 'putConversation')
    await useAppStore.getState().addTag('c1', '   ')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('app-store.setConversationNote', () => {
  it('sets and clears note', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    await useAppStore.getState().setConversationNote('c1', 'remember why')
    expect(useAppStore.getState().conversations.find((c) => c.id === 'c1')?.note).toBe('remember why')
    await useAppStore.getState().setConversationNote('c1', '')
    expect(useAppStore.getState().conversations.find((c) => c.id === 'c1')?.note).toBeUndefined()
  })

  it('clears note when given undefined', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1' })])
    await useAppStore.getState().setConversationNote('c1', 'x')
    await useAppStore.getState().setConversationNote('c1', undefined)
    expect(useAppStore.getState().conversations.find((c) => c.id === 'c1')?.note).toBeUndefined()
  })

  it('does not write to IDB when note is unchanged', async () => {
    await useAppStore.getState().load()
    await seedConversations([mkConversation({ id: 'c1', note: 'same' })])
    const spy = vi.spyOn(db, 'putConversation')
    await useAppStore.getState().setConversationNote('c1', 'same')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('app-store.selectConv / clearSelection', () => {
  it("'toggle' adds then removes membership", () => {
    useAppStore.getState().selectConv('a', 'toggle')
    expect(Array.from(useAppStore.getState().selectedConvIds)).toEqual(['a'])
    useAppStore.getState().selectConv('a', 'toggle')
    expect(Array.from(useAppStore.getState().selectedConvIds)).toEqual([])
  })

  it("'replace' sets the selection to exactly that id", () => {
    useAppStore.setState({ selectedConvIds: new Set(['x', 'y', 'z']) })
    useAppStore.getState().selectConv('only', 'replace')
    expect(Array.from(useAppStore.getState().selectedConvIds)).toEqual(['only'])
  })

  it("'range' across multiple visibleIds selects inclusive range", () => {
    // 先点 'b' 设 anchor,再 shift+click 'd' → 应包含 b/c/d
    useAppStore.getState().selectConv('b', 'replace')
    useAppStore.getState().selectConv('d', 'range', ['a', 'b', 'c', 'd', 'e'])
    const sel = Array.from(useAppStore.getState().selectedConvIds).sort()
    expect(sel).toEqual(['b', 'c', 'd'])
  })

  it("'range' with reverse direction still picks inclusive set", () => {
    useAppStore.getState().selectConv('d', 'replace')
    useAppStore.getState().selectConv('a', 'range', ['a', 'b', 'c', 'd'])
    const sel = Array.from(useAppStore.getState().selectedConvIds).sort()
    expect(sel).toEqual(['a', 'b', 'c', 'd'])
  })

  it("'range' without prior anchor degenerates to 'replace'", () => {
    // 未点过任何 id 就 shift+click 应等价于普通点击
    useAppStore.getState().selectConv('c', 'range', ['a', 'b', 'c', 'd'])
    expect(Array.from(useAppStore.getState().selectedConvIds)).toEqual(['c'])
  })

  it("'toggle' updates the anchor for subsequent 'range'", () => {
    useAppStore.getState().selectConv('a', 'toggle')
    useAppStore.getState().selectConv('c', 'range', ['a', 'b', 'c'])
    const sel = Array.from(useAppStore.getState().selectedConvIds).sort()
    expect(sel).toEqual(['a', 'b', 'c'])
  })

  it('clearSelection empties the set', () => {
    useAppStore.setState({ selectedConvIds: new Set(['a', 'b']) })
    useAppStore.getState().clearSelection()
    expect(useAppStore.getState().selectedConvIds.size).toBe(0)
  })

  it('clearSelection also clears the anchor', () => {
    // 给 anchor 设值,clear 后再 shift+click 不应回到旧 anchor
    useAppStore.getState().selectConv('a', 'replace')
    useAppStore.getState().clearSelection()
    useAppStore.getState().selectConv('c', 'range', ['a', 'b', 'c'])
    expect(Array.from(useAppStore.getState().selectedConvIds)).toEqual(['c'])
  })
})
