import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  openDb,
  putSpace,
  getSpace,
  allSpaces,
  deleteSpace,
  putConversation,
  getConversation,
  allConversations,
  conversationsInSpace,
  conversationsByPlatform,
  deleteConversation,
  putMessages,
  messagesForConversation,
  bulkPutConversations,
  bulkPutMessages,
  __resetForTest,
} from '@/lib/db'
import type { Space, Conversation, Message } from '@/lib/schema'

// 每个 case 前清库 + 重置 dbPromise 缓存,避免 idb 拿着旧的 db handle 写到已删除的库。
// 先 close 老连接再 deleteDatabase,否则 fake-indexeddb 会卡在 versionchange。
beforeEach(async () => {
  await __resetForTest()
  await indexedDB.deleteDatabase('spacemind')
})

const mkSpace = (overrides: Partial<Space> = {}): Space => ({
  id: 's1',
  name: 'Work',
  color: 'indigo',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

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

const mkMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  conversationId: 'c1',
  role: 'user',
  content: 'hello',
  timestamp: 0,
  ...overrides,
})

describe('openDb', () => {
  it('returns a working DB on first call', async () => {
    const db = await openDb()
    expect(db).toBeDefined()
    expect(db.name).toBe('spacemind')
    expect(Array.from(db.objectStoreNames).sort()).toEqual([
      'conversations',
      'messages',
      'spaces',
    ])
  })

  it('reuses the cached instance across calls', async () => {
    const a = await openDb()
    const b = await openDb()
    expect(a).toBe(b)
  })
})

describe('db.spaces', () => {
  it('putSpace + getSpace roundtrip', async () => {
    await putSpace(mkSpace({ id: 's1', name: 'Work', updatedAt: 100 }))
    const read = await getSpace('s1')
    expect(read?.name).toBe('Work')
    expect(read?.updatedAt).toBe(100)
  })

  it('allSpaces returns sorted by updatedAt desc', async () => {
    await putSpace(mkSpace({ id: 'a', updatedAt: 100 }))
    await putSpace(mkSpace({ id: 'b', color: 'emerald', updatedAt: 200 }))
    await putSpace(mkSpace({ id: 'c', color: 'amber', updatedAt: 50 }))
    const list = await allSpaces()
    expect(list.map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })

  it('deleteSpace removes a space', async () => {
    await putSpace(mkSpace({ id: 's1' }))
    await deleteSpace('s1')
    expect(await getSpace('s1')).toBeUndefined()
  })
})

describe('db.conversations', () => {
  it('putConversation + getConversation roundtrip', async () => {
    await putConversation(mkConversation({ id: 'c1', title: 'Hello' }))
    const read = await getConversation('c1')
    expect(read?.title).toBe('Hello')
  })

  it('allConversations returns everything written', async () => {
    await putConversation(mkConversation({ id: 'c1' }))
    await putConversation(mkConversation({ id: 'c2', url: 'https://chatgpt.com/c/c2' }))
    const list = await allConversations()
    expect(list.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
  })

  it('conversationsInSpace filters by spaceId via index', async () => {
    await putConversation(mkConversation({ id: 'c1', spaceId: 's1' }))
    await putConversation(
      mkConversation({ id: 'c2', spaceId: 's2', url: 'https://chatgpt.com/c/c2' })
    )
    await putConversation(
      mkConversation({ id: 'c3', spaceId: 's1', url: 'https://chatgpt.com/c/c3' })
    )
    const inS1 = await conversationsInSpace('s1')
    expect(inS1.map((c) => c.id).sort()).toEqual(['c1', 'c3'])
  })

  it('conversationsByPlatform filters by platform via index', async () => {
    await putConversation(mkConversation({ id: 'c1', platform: 'chatgpt' }))
    await putConversation(
      mkConversation({
        id: 'c2',
        platform: 'claude',
        url: 'https://claude.ai/chat/c2',
      })
    )
    const chatgpt = await conversationsByPlatform('chatgpt')
    expect(chatgpt.map((c) => c.id)).toEqual(['c1'])
    const claude = await conversationsByPlatform('claude')
    expect(claude.map((c) => c.id)).toEqual(['c2'])
  })

  it('deleteConversation removes a conversation', async () => {
    await putConversation(mkConversation({ id: 'c1' }))
    await deleteConversation('c1')
    expect(await getConversation('c1')).toBeUndefined()
  })
})

describe('db.messages', () => {
  it('putMessages bulk insert writes all rows atomically', async () => {
    const messages: Message[] = [
      mkMessage({ id: 'm1', timestamp: 1, content: 'one' }),
      mkMessage({ id: 'm2', timestamp: 2, content: 'two', role: 'assistant' }),
      mkMessage({ id: 'm3', timestamp: 3, content: 'three' }),
    ]
    await putMessages(messages)
    const all = await messagesForConversation('c1')
    expect(all.map((m) => m.id).sort()).toEqual(['m1', 'm2', 'm3'])
  })

  it('messagesForConversation returns only messages for that conversation', async () => {
    await putMessages([
      mkMessage({ id: 'm1', conversationId: 'c1', timestamp: 1 }),
      mkMessage({ id: 'm2', conversationId: 'c2', timestamp: 2 }),
      mkMessage({ id: 'm3', conversationId: 'c1', timestamp: 3 }),
    ])
    const c1 = await messagesForConversation('c1')
    expect(c1.map((m) => m.id).sort()).toEqual(['m1', 'm3'])
    const c2 = await messagesForConversation('c2')
    expect(c2.map((m) => m.id)).toEqual(['m2'])
  })

  it('messagesForConversation returns messages in insertion order', async () => {
    // 索引扫描默认按主键升序,m1 < m2 < m3 字典序就是插入顺序
    await putMessages([
      mkMessage({ id: 'm1', conversationId: 'c1', timestamp: 100 }),
      mkMessage({ id: 'm2', conversationId: 'c1', timestamp: 50 }),
      mkMessage({ id: 'm3', conversationId: 'c1', timestamp: 200 }),
    ])
    const list = await messagesForConversation('c1')
    expect(list.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })
})

describe('db.bulk inserts', () => {
  it('bulkPutConversations writes 100 rows in a single tx and all are readable', async () => {
    // 100 行规模够触发"批量写"语义,但不会让 fake-indexeddb 跑很慢
    const rows = Array.from({ length: 100 }, (_, i) =>
      mkConversation({
        id: `c-${i}`,
        title: `Title ${i}`,
        url: `https://chatgpt.com/c/c-${i}`,
      })
    )
    await bulkPutConversations(rows)
    const list = await allConversations()
    expect(list).toHaveLength(100)
    // 抽样验证某些行的字段保真,避免只校验数量但内容错乱
    const c42 = list.find((c) => c.id === 'c-42')
    expect(c42?.title).toBe('Title 42')
  })

  it('bulkPutConversations on empty array is a no-op (no tx, no throw)', async () => {
    await bulkPutConversations([])
    const list = await allConversations()
    expect(list).toEqual([])
  })

  it('bulkPutMessages writes 100 rows in a single tx and all are readable', async () => {
    const rows = Array.from({ length: 100 }, (_, i) =>
      mkMessage({
        id: `m-${i}`,
        conversationId: 'c1',
        content: `body ${i}`,
        timestamp: i,
      })
    )
    await bulkPutMessages(rows)
    const list = await messagesForConversation('c1')
    expect(list).toHaveLength(100)
    expect(list.find((m) => m.id === 'm-99')?.content).toBe('body 99')
  })

  it('bulkPutMessages on empty array is a no-op (no tx, no throw)', async () => {
    await bulkPutMessages([])
    const list = await messagesForConversation('c1')
    expect(list).toEqual([])
  })
})
