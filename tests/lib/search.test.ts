import { describe, it, expect } from 'vitest'
import { createSearchIndex } from '@/lib/search'
import type { Conversation, Message } from '@/lib/schema'

const convs: Conversation[] = [
  {
    id: 'c1', platform: 'chatgpt', url: 'https://chatgpt.com/c/c1',
    title: 'Centering a div', tags: [], starred: false, capturedAt: 0,
    preview: { firstUserMessage: 'how do I center a div?' },
  },
  {
    id: 'c2', platform: 'claude', url: 'https://claude.ai/chat/c2',
    title: 'Tailwind dark mode', tags: [], starred: false, capturedAt: 0,
  },
]

const msgs: Message[] = [
  { id: 'c1:m1', conversationId: 'c1', role: 'user', content: 'how do I center a div?', timestamp: 0 },
  { id: 'c1:m2', conversationId: 'c1', role: 'assistant', content: 'use flexbox with justify-content', timestamp: 0 },
  { id: 'c2:m1', conversationId: 'c2', role: 'assistant', content: 'use @custom-variant dark in tailwind v4', timestamp: 0 },
]

describe('createSearchIndex', () => {
  it('returns conversation hits matching the title', () => {
    const idx = createSearchIndex({ conversations: convs, messages: msgs })
    const hits = idx.query('tailwind')
    expect(hits.map((h) => h.conversationId)).toContain('c2')
  })

  it('returns conversation hits matching message content', () => {
    const idx = createSearchIndex({ conversations: convs, messages: msgs })
    const hits = idx.query('flexbox')
    expect(hits.map((h) => h.conversationId)).toContain('c1')
  })

  it('deduplicates a single conversation across multiple matching messages', () => {
    const idx = createSearchIndex({ conversations: convs, messages: msgs })
    const hits = idx.query('div')
    const ids = hits.map((h) => h.conversationId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('returns empty array for no match', () => {
    const idx = createSearchIndex({ conversations: convs, messages: msgs })
    expect(idx.query('xyzxyz')).toEqual([])
  })

  // 默认 encoder 不切 CJK,只能从开头命中;自定义 encoder 改成逐字切 token,
  // 任意位置出现的字组都能命中。这两个 case 锁住该行为。
  it('matches CJK substring anywhere in title (not only prefix)', () => {
    const cjkConvs: Conversation[] = [
      {
        id: 'cj1', platform: 'chatgpt', url: 'https://chatgpt.com/c/cj1',
        title: '前端开发笔记', tags: [], starred: false, capturedAt: 0,
      },
    ]
    const idx = createSearchIndex({ conversations: cjkConvs, messages: [] })
    expect(idx.query('开发').map((h) => h.conversationId)).toContain('cj1')
    expect(idx.query('笔记').map((h) => h.conversationId)).toContain('cj1')
  })

  it('matches CJK substring inside message content', () => {
    const cjkConvs: Conversation[] = [
      {
        id: 'cj2', platform: 'claude', url: 'https://claude.ai/chat/cj2',
        title: 'Untitled', tags: [], starred: false, capturedAt: 0,
      },
    ]
    const cjkMsgs: Message[] = [
      { id: 'cj2:m1', conversationId: 'cj2', role: 'user', content: '解释一下深拷贝和浅拷贝的区别', timestamp: 0 },
    ]
    const idx = createSearchIndex({ conversations: cjkConvs, messages: cjkMsgs })
    expect(idx.query('深拷贝').map((h) => h.conversationId)).toContain('cj2')
  })
})
