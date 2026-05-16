import { describe, it, expect } from 'vitest'
import { RuntimeMessageSchema } from '@/lib/runtime-messages'

// 这套测试只验证 schema 本身,不去 mock chrome.runtime —— sendRuntimeMessage 走集成层
describe('RuntimeMessageSchema', () => {
  it('parses conversation:save-current', () => {
    const r = RuntimeMessageSchema.safeParse({
      kind: 'conversation:save-current',
      platform: 'chatgpt',
      conversation: { id: 'abc', url: 'https://chatgpt.com/c/abc', title: 'T' },
      spaceId: 'sp1',
    })
    expect(r.success).toBe(true)
  })

  it('parses spaces:list-request and spaces:list-reply', () => {
    expect(RuntimeMessageSchema.safeParse({ kind: 'spaces:list-request' }).success).toBe(true)
    expect(
      RuntimeMessageSchema.safeParse({
        kind: 'spaces:list-reply',
        spaces: [{ id: 's', name: 'X', color: 'indigo', createdAt: 0, updatedAt: 0 }],
      }).success,
    ).toBe(true)
  })

  it('parses conversations:batch-upsert from sidebar scraper', () => {
    expect(
      RuntimeMessageSchema.safeParse({
        kind: 'conversations:batch-upsert',
        platform: 'claude',
        conversations: [{ id: 'c1', url: 'https://claude.ai/chat/c1', title: 'T' }],
      }).success,
    ).toBe(true)
  })

  it('rejects unknown kind', () => {
    expect(RuntimeMessageSchema.safeParse({ kind: 'bogus' }).success).toBe(false)
  })

  // 关键回归:reply 里只要任一 Space 行损坏不应该让整批废掉。
  // 之前 schema 是 z.array(SpaceSchema),一条坏数据让 overlay 看不到任何空间
  it('drops invalid Space rows in spaces:list-reply but keeps valid ones', () => {
    const r = RuntimeMessageSchema.safeParse({
      kind: 'spaces:list-reply',
      spaces: [
        { id: 'good', name: 'OK', color: 'indigo', createdAt: 0, updatedAt: 0 },
        { id: 'bad', name: '', color: 'indigo', createdAt: 0, updatedAt: 0 }, // empty name → invalid
        { id: 'good2', name: 'Also OK', color: 'violet', createdAt: 0, updatedAt: 0 },
      ],
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    if (r.data.kind !== 'spaces:list-reply') return
    expect(r.data.spaces.map((s) => s.id)).toEqual(['good', 'good2'])
  })
})
