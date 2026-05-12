import { describe, it, expect } from 'vitest'
import { parseChatGPTExport } from '@/lib/zip-import/chatgpt'
import sample from '../../fixtures/chatgpt-export-sample.json'

describe('parseChatGPTExport', () => {
  it('flattens a linear conversation', () => {
    const result = parseChatGPTExport(sample)
    const conv = result.conversations.find((c) => c.title === 'How to center a div')
    expect(conv).toBeDefined()
    const messages = result.messages.filter((m) => m.conversationId === conv!.id)
    expect(messages.map((m) => m.content)).toEqual([
      'How do I center a div?',
      'Use flexbox with justify-content and align-items.',
      'Thanks!',
    ])
  })

  it('walks current_node back to root, ignoring forked siblings', () => {
    const result = parseChatGPTExport(sample)
    const conv = result.conversations.find((c) => c.title === 'Greet in French')!
    const messages = result.messages.filter((m) => m.conversationId === conv.id)
    expect(messages.map((m) => m.content)).toEqual(['Say hi', 'Bonjour!'])
    expect(messages.find((m) => m.content === 'Hello!')).toBeUndefined()
  })

  it('produces Conversation rows with the correct shape', () => {
    const result = parseChatGPTExport(sample)
    const conv = result.conversations[0]!
    expect(conv.platform).toBe('chatgpt')
    expect(conv.url).toMatch(/^https:\/\/chatgpt\.com\/c\//)
    expect(conv.tags).toEqual([])
    expect(conv.starred).toBe(false)
    expect(typeof conv.capturedAt).toBe('number')
    expect(typeof conv.platformUpdatedAt).toBe('number')
  })

  it('populates preview.firstUserMessage and preview.lastAssistantMessage', () => {
    const result = parseChatGPTExport(sample)
    const conv = result.conversations.find((c) => c.title === 'How to center a div')!
    expect(conv.preview?.firstUserMessage).toBe('How do I center a div?')
    expect(conv.preview?.lastAssistantMessage).toBe(
      'Use flexbox with justify-content and align-items.',
    )
  })

  it('converts epoch-seconds timestamps to milliseconds', () => {
    const result = parseChatGPTExport(sample)
    const conv = result.conversations[0]!
    // 1714900500 * 1000 = 1714900500000
    expect(conv.platformUpdatedAt).toBe(1714900500000)
  })

  it('returns empty arrays for empty input', () => {
    const result = parseChatGPTExport([])
    expect(result.conversations).toEqual([])
    expect(result.messages).toEqual([])
  })
})
