import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Space, Conversation, Message, Platform } from './schema'
import type { ScrapedConversation } from './runtime-messages'

// IndexedDB 名/版本集中放这里 —— 升级 schema 必须同步改 DB_VERSION 并补 upgrade 分支
const DB_NAME = 'spacemind'
const DB_VERSION = 1

interface SpaceMindDB extends DBSchema {
  spaces: {
    key: string
    value: Space
    indexes: { 'by-updatedAt': number }
  }
  conversations: {
    key: string
    value: Conversation
    indexes: {
      'by-spaceId': string
      'by-platform': string
      'by-capturedAt': number
    }
  }
  messages: {
    key: string
    value: Message
    indexes: { 'by-conversationId': string }
  }
}

// 模块级 promise 单例 —— 同进程多次调用共享一个 DB 句柄,避免重复 open
let dbPromise: Promise<IDBPDatabase<SpaceMindDB>> | null = null

export function openDb(): Promise<IDBPDatabase<SpaceMindDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpaceMindDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const spaces = db.createObjectStore('spaces', { keyPath: 'id' })
        spaces.createIndex('by-updatedAt', 'updatedAt')

        const conversations = db.createObjectStore('conversations', {
          keyPath: 'id',
        })
        conversations.createIndex('by-spaceId', 'spaceId')
        conversations.createIndex('by-platform', 'platform')
        conversations.createIndex('by-capturedAt', 'capturedAt')

        const messages = db.createObjectStore('messages', { keyPath: 'id' })
        messages.createIndex('by-conversationId', 'conversationId')
      },
    })
  }
  return dbPromise
}

// 仅供测试用:关闭并清掉模块级缓存,让下次 openDb 重新建库。
// 不关旧句柄就 deleteDatabase,fake-indexeddb 会一直阻塞在 versionchange。
// 生产代码不会调用 —— 不要在 UI 层引用。
export async function __resetForTest(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise
      db.close()
    } catch {
      // 打开就失败的情况无需清理
    }
    dbPromise = null
  }
}

// ---- Spaces ----

export async function putSpace(s: Space): Promise<void> {
  const db = await openDb()
  await db.put('spaces', s)
}

export async function getSpace(id: string): Promise<Space | undefined> {
  const db = await openDb()
  return db.get('spaces', id)
}

export async function allSpaces(): Promise<Space[]> {
  const db = await openDb()
  // by-updatedAt 索引天然升序,需要降序就反向开游标 —— 比 getAll().reverse() 省内存
  const out: Space[] = []
  const tx = db.transaction('spaces', 'readonly')
  const index = tx.store.index('by-updatedAt')
  let cursor = await index.openCursor(null, 'prev')
  while (cursor) {
    out.push(cursor.value)
    cursor = await cursor.continue()
  }
  await tx.done
  return out
}

export async function deleteSpace(id: string): Promise<void> {
  const db = await openDb()
  await db.delete('spaces', id)
}

// ---- Conversations ----

export async function putConversation(c: Conversation): Promise<void> {
  const db = await openDb()
  await db.put('conversations', c)
}

export async function getConversation(
  id: string
): Promise<Conversation | undefined> {
  const db = await openDb()
  return db.get('conversations', id)
}

export async function allConversations(): Promise<Conversation[]> {
  const db = await openDb()
  return db.getAll('conversations')
}

export async function conversationsInSpace(
  spaceId: string
): Promise<Conversation[]> {
  const db = await openDb()
  return db.getAllFromIndex('conversations', 'by-spaceId', spaceId)
}

export async function conversationsByPlatform(
  platform: Platform
): Promise<Conversation[]> {
  const db = await openDb()
  return db.getAllFromIndex('conversations', 'by-platform', platform)
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await openDb()
  await db.delete('conversations', id)
}

// 把一组 conversation 的位置写成给定顺序 —— ids[0] 拿 0, ids[1] 拿 1, ...
// 调用方需要保证 ids 是用户期望的最终顺序(已包含未移动的 + 移动的)。
// 单事务保证排序结果原子写入,不会出现中间态;platformUpdatedAt 不动,只动 sortIndex。
export async function bulkUpdateConversationOrder(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDb()
  const tx = db.transaction('conversations', 'readwrite')
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!
    const existing = await tx.store.get(id)
    if (!existing) continue
    if (existing.sortIndex === i) continue
    await tx.store.put({ ...existing, sortIndex: i })
  }
  await tx.done
}

// 批量改写一组 conversation 的 spaceId。null 表示移出空间,
// 在 exactOptionalPropertyTypes 下要"删字段"而不是写 spaceId: undefined。
// 单事务保证半截失败不会留下错位的归属。
export async function bulkUpdateConversationSpace(
  ids: string[],
  spaceId: string | null,
  now: number,
): Promise<void> {
  if (ids.length === 0) return
  const db = await openDb()
  const tx = db.transaction('conversations', 'readwrite')
  for (const id of ids) {
    const existing = await tx.store.get(id)
    if (!existing) continue
    let next: Conversation
    if (spaceId === null) {
      // 解构丢弃 spaceId 而不是赋 undefined,避免在 IDB 里留下 "spaceId: undefined" 这类不规整字段
      const { spaceId: _drop, ...rest } = existing
      void _drop
      next = { ...rest, platformUpdatedAt: now }
    } else {
      next = { ...existing, spaceId, platformUpdatedAt: now }
    }
    await tx.store.put(next)
  }
  await tx.done
}

// 级联删除一组 conversation 以及它们的全部 messages。
// idb 每个事务只能对应一个 store,所以 conversations / messages 各开一笔事务。
// 这意味着两者非原子:极端情况下 conversations 已删但 messages 残留 ——
// 残留 messages 失去归属,UI 不会再引用,后续清理任务可以扫底,代价可接受
export async function deleteConversationsCascade(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDb()

  // 先删 messages:用 by-conversationId 索引开游标扫一遍,匹配命中的 id 集合就删
  const idSet = new Set(ids)
  const mtx = db.transaction('messages', 'readwrite')
  const mIndex = mtx.store.index('by-conversationId')
  let cursor = await mIndex.openCursor()
  while (cursor) {
    if (idSet.has(cursor.value.conversationId)) {
      await cursor.delete()
    }
    cursor = await cursor.continue()
  }
  await mtx.done

  // 再删 conversations 本身
  const ctx = db.transaction('conversations', 'readwrite')
  for (const id of ids) {
    await ctx.store.delete(id)
  }
  await ctx.done
}

// 批量写 conversations:用单一事务,失败整批回滚,避免半截数据污染列表视图
export async function bulkPutConversations(
  rows: Conversation[]
): Promise<void> {
  if (rows.length === 0) return
  const db = await openDb()
  const tx = db.transaction('conversations', 'readwrite')
  await Promise.all([...rows.map((r) => tx.store.put(r)), tx.done])
}

// sidebar scraper 调用入口:对每条 scraped 条目,已存在则保留用户字段
// (spaceId / tags / starred / note / capturedAt),仅刷新平台层 url / title / platformUpdatedAt;
// 不存在则用 now 作为 capturedAt + platformUpdatedAt 新建。整批一个事务,失败回滚。
export async function bulkUpsertScrapedConversations(
  platform: Platform,
  scraped: ScrapedConversation[],
  now: number,
): Promise<{ added: number; updated: number }> {
  if (scraped.length === 0) return { added: 0, updated: 0 }
  const db = await openDb()
  const tx = db.transaction('conversations', 'readwrite')
  let added = 0
  let updated = 0
  for (const s of scraped) {
    const existing = await tx.store.get(s.id)
    if (existing) {
      // exactOptionalPropertyTypes 下不能用 `field: existing.field` 把 undefined 显式赋回去,
      // 全 spread 既保留用户字段,又只覆盖明确要刷新的几列
      const next: Conversation = {
        ...existing,
        title: s.title || existing.title,
        url: s.url,
        platformUpdatedAt: now,
      }
      await tx.store.put(next)
      updated++
    } else {
      const fresh: Conversation = {
        id: s.id,
        platform,
        url: s.url,
        title: s.title,
        tags: [],
        starred: false,
        capturedAt: now,
        platformUpdatedAt: now,
      }
      await tx.store.put(fresh)
      added++
    }
  }
  await tx.done
  return { added, updated }
}

// ---- Messages ----

export async function putMessages(messages: Message[]): Promise<void> {
  if (messages.length === 0) return
  const db = await openDb()
  // 单事务批写:任意一条失败整批回滚,避免半截数据污染对话视图
  const tx = db.transaction('messages', 'readwrite')
  await Promise.all([...messages.map((m) => tx.store.put(m)), tx.done])
}

// putMessages 的别名语义化:导入场景下与 bulkPutConversations 配对使用,可读性更好
export async function bulkPutMessages(rows: Message[]): Promise<void> {
  if (rows.length === 0) return
  const db = await openDb()
  const tx = db.transaction('messages', 'readwrite')
  await Promise.all([...rows.map((r) => tx.store.put(r)), tx.done])
}

export async function messagesForConversation(
  conversationId: string
): Promise<Message[]> {
  const db = await openDb()
  return db.getAllFromIndex('messages', 'by-conversationId', conversationId)
}

// 一次性导出整库 messages —— 仅给 JSON 备份/导出用,UI 列表不应调用(可能很大)
export async function allMessages(): Promise<Message[]> {
  const db = await openDb()
  return db.getAll('messages')
}
