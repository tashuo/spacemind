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
})
