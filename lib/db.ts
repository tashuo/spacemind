import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Space, Conversation, Message, Platform } from './schema'

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

// ---- Messages ----

export async function putMessages(messages: Message[]): Promise<void> {
  if (messages.length === 0) return
  const db = await openDb()
  // 单事务批写:任意一条失败整批回滚,避免半截数据污染对话视图
  const tx = db.transaction('messages', 'readwrite')
  await Promise.all([...messages.map((m) => tx.store.put(m)), tx.done])
}

export async function messagesForConversation(
  conversationId: string
): Promise<Message[]> {
  const db = await openDb()
  return db.getAllFromIndex('messages', 'by-conversationId', conversationId)
}
