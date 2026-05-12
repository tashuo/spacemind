import { describe, it, expect } from 'vitest'
import { parseClaudeExport } from '@/lib/zip-import/claude'
import sample from '../../fixtures/claude-export-sample.json'

describe('parseClaudeExport', () => {
  it('flattens chat_messages with mapped roles', () => {
    const result = parseClaudeExport(sample)
    const conv = result.conversations.find((c) => c.title === 'Tailwind dark mode setup')!
    const msgs = result.messages.filter((m) => m.conversationId === conv.id)
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant']) // 'human' → 'user'
    expect(msgs[1]!.content).toContain('@custom-variant dark')
  })

  it('parses ISO timestamps to milliseconds', () => {
    const result = parseClaudeExport(sample)
    const conv = result.conversations.find((c) => c.title === 'Tailwind dark mode setup')!
    // 2025-08-15T09:05:00Z = 1755247500000
    expect(conv.platformUpdatedAt).toBe(Date.parse('2025-08-15T09:05:00Z'))
  })

  it('produces Conversation with claude platform and URL', () => {
    const result = parseClaudeExport(sample)
    const conv = result.conversations[0]!
    expect(conv.platform).toBe('claude')
    expect(conv.url).toMatch(/^https:\/\/claude\.ai\/chat\//)
  })

  it('populates preview from first user + last assistant', () => {
    const result = parseClaudeExport(sample)
    const conv = result.conversations.find((c) => c.title === 'Recipe ideas')!
    expect(conv.preview?.firstUserMessage).toBe('Three vegetarian dinner ideas?')
    expect(conv.preview?.lastAssistantMessage).toMatch(/^1\. Roasted/)
  })

  it('returns empty arrays for empty input', () => {
    expect(parseClaudeExport([])).toEqual({ conversations: [], messages: [] })
  })
})
