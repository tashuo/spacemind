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
})
