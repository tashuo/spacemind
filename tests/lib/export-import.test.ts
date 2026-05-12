import { describe, it, expect } from 'vitest'
import {
  serializeForExport,
  parseImport,
  exportFilename,
  mergeSpace,
  mergeConversation,
  type ExportInput,
} from '@/lib/export-import'
import type { Space, Conversation, Message } from '@/lib/schema'

// 最小可用 fixture —— 每个对象都过 schema,所以字段不能省
const sampleSpace: Space = {
  id: 'sp-1',
  name: 'Work',
  color: 'indigo',
  createdAt: 100,
  updatedAt: 200,
}

const sampleConversation: Conversation = {
  id: 'c-1',
  platform: 'chatgpt',
  url: 'https://chatgpt.com/c/c-1',
  title: 'Hello',
  tags: [],
  starred: false,
  capturedAt: 300,
}

const sampleMessage: Message = {
  id: 'm-1',
  conversationId: 'c-1',
  role: 'user',
  content: 'hi',
  timestamp: 400,
}

const sampleInput: ExportInput = {
  spaces: [sampleSpace],
  conversations: [sampleConversation],
  messages: [sampleMessage],
}

describe('serializeForExport + parseImport', () => {
  it('round-trips: serialized + parsed back equals the original', () => {
    const json = serializeForExport(sampleInput, 999)
    const parsed = parseImport(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return // narrow

    expect(parsed.file.format).toBe('spacemind-export')
    expect(parsed.file.formatVersion).toBe(1)
    expect(parsed.file.app).toBe('SpaceMind')
    expect(parsed.file.exportedAt).toBe(999)
    expect(parsed.file.spaces).toEqual(sampleInput.spaces)
    expect(parsed.file.conversations).toEqual(sampleInput.conversations)
    expect(parsed.file.messages).toEqual(sampleInput.messages)
  })

  it('parseImport rejects invalid JSON', () => {
    const result = parseImport('not json at all{')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid-json')
  })

  it('parseImport rejects valid JSON with wrong shape (e.g. spacetab export)', () => {
    const wrong = JSON.stringify({ format: 'spacetab-export', formatVersion: 1, db: {} })
    const result = parseImport(wrong)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid-shape')
  })

  it('parseImport accepts a hand-crafted v1 file', () => {
    const minimal = {
      format: 'spacemind-export',
      formatVersion: 1,
      app: 'SpaceMind',
      exportedAt: 1,
      spaces: [] as Space[],
      conversations: [] as Conversation[],
      messages: [] as Message[],
    }
    const result = parseImport(JSON.stringify(minimal))
    expect(result.ok).toBe(true)
  })
})

describe('exportFilename', () => {
  it('formats date with zero-padded fields', () => {
    // 2026-01-02 03:04 -> spacemind-2026-01-02-0304.json
    const t = new Date(2026, 0, 2, 3, 4).getTime()
    expect(exportFilename(t)).toBe('spacemind-2026-01-02-0304.json')
  })
})

describe('mergeSpace / mergeConversation', () => {
  it('mergeSpace preserves user metadata, overwrites name/color/updatedAt', () => {
    const existing: Space = {
      ...sampleSpace,
      emoji: '🌱',
      note: 'my note',
      pinned: true,
      sortIndex: 5,
      createdAt: 50,
    }
    const incoming: Space = {
      ...sampleSpace,
      name: 'Work renamed',
      color: 'emerald',
      updatedAt: 9999,
    }
    const merged = mergeSpace(existing, incoming)
    expect(merged.name).toBe('Work renamed')
    expect(merged.color).toBe('emerald')
    expect(merged.updatedAt).toBe(9999)
    expect(merged.emoji).toBe('🌱')
    expect(merged.note).toBe('my note')
    expect(merged.pinned).toBe(true)
    expect(merged.sortIndex).toBe(5)
    expect(merged.createdAt).toBe(50) // 保留首次创建时间
  })

  it('mergeConversation preserves user metadata, overwrites platform fields', () => {
    const existing: Conversation = {
      ...sampleConversation,
      spaceId: 'sp-user',
      tags: ['important'],
      starred: true,
      note: 'follow up',
      capturedAt: 11,
    }
    const incoming: Conversation = {
      ...sampleConversation,
      title: 'New Title',
      url: 'https://chatgpt.com/c/c-1?fresh',
    }
    const merged = mergeConversation(existing, incoming)
    expect(merged.title).toBe('New Title')
    expect(merged.url).toBe('https://chatgpt.com/c/c-1?fresh')
    expect(merged.spaceId).toBe('sp-user')
    expect(merged.tags).toEqual(['important'])
    expect(merged.starred).toBe(true)
    expect(merged.note).toBe('follow up')
    expect(merged.capturedAt).toBe(11)
  })

  it('mergeSpace / mergeConversation return incoming unchanged when no existing', () => {
    expect(mergeSpace(undefined, sampleSpace)).toEqual(sampleSpace)
    expect(mergeConversation(undefined, sampleConversation)).toEqual(sampleConversation)
  })
})
