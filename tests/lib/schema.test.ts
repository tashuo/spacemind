import { describe, it, expect } from 'vitest'
import {
  PaletteKeySchema,
  PlatformSchema,
  RoleSchema,
  SpaceSchema,
  ConversationSchema,
  MessageSchema,
  AppSettingsSchema,
} from '@/lib/schema'

// PaletteKeySchema —— 用户主题色板必须严格收敛,新增颜色需要走 schema 升级
describe('PaletteKeySchema', () => {
  it('accepts all 6 palette keys', () => {
    for (const key of ['indigo', 'emerald', 'amber', 'pink', 'violet', 'cyan'] as const) {
      expect(PaletteKeySchema.safeParse(key).success).toBe(true)
    }
  })

  it('rejects arbitrary color strings', () => {
    expect(PaletteKeySchema.safeParse('magenta').success).toBe(false)
    expect(PaletteKeySchema.safeParse('').success).toBe(false)
    expect(PaletteKeySchema.safeParse(123).success).toBe(false)
  })
})

// PlatformSchema —— 目前只支持 chatgpt / claude,其他平台必须明确扩展 schema 才能进
describe('PlatformSchema', () => {
  it('accepts chatgpt and claude', () => {
    expect(PlatformSchema.safeParse('chatgpt').success).toBe(true)
    expect(PlatformSchema.safeParse('claude').success).toBe(true)
  })

  it('rejects unsupported platforms', () => {
    expect(PlatformSchema.safeParse('mistral').success).toBe(false)
    expect(PlatformSchema.safeParse('gemini').success).toBe(false)
    expect(PlatformSchema.safeParse('random-string').success).toBe(false)
  })
})

// RoleSchema —— 与 OpenAI/Anthropic 一致的四种 role,避免后续解析时遇到 tool 又得改 schema
describe('RoleSchema', () => {
  it('accepts user / assistant / system / tool', () => {
    for (const role of ['user', 'assistant', 'system', 'tool'] as const) {
      expect(RoleSchema.safeParse(role).success).toBe(true)
    }
  })

  it('rejects unknown roles', () => {
    expect(RoleSchema.safeParse('bot').success).toBe(false)
    expect(RoleSchema.safeParse('').success).toBe(false)
  })
})

describe('SpaceSchema', () => {
  it('parses a minimal valid space', () => {
    const result = SpaceSchema.safeParse({
      id: 's1',
      name: 'Work',
      color: 'indigo',
      createdAt: 1000,
      updatedAt: 1000,
    })
    expect(result.success).toBe(true)
  })

  it('parses a fully populated space with all optionals', () => {
    const result = SpaceSchema.safeParse({
      id: 's2',
      name: 'Research',
      emoji: '🧠',
      note: 'AI safety notes',
      color: 'violet',
      pinned: true,
      sortIndex: 0,
      createdAt: 1,
      updatedAt: 2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = SpaceSchema.safeParse({
      id: 's1',
      name: '',
      color: 'indigo',
      createdAt: 0,
      updatedAt: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty id', () => {
    const result = SpaceSchema.safeParse({
      id: '',
      name: 'Work',
      color: 'indigo',
      createdAt: 0,
      updatedAt: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown color', () => {
    const result = SpaceSchema.safeParse({
      id: 's1',
      name: 'A',
      color: 'magenta',
      createdAt: 0,
      updatedAt: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects note longer than 500 chars', () => {
    const result = SpaceSchema.safeParse({
      id: 's1',
      name: 'A',
      color: 'indigo',
      note: 'x'.repeat(501),
      createdAt: 0,
      updatedAt: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('ConversationSchema', () => {
  it('parses a valid chatgpt conversation', () => {
    const r = ConversationSchema.safeParse({
      id: 'abc-123',
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/abc-123',
      title: 'How to center a div',
      tags: [],
      starred: false,
      capturedAt: 1000,
    })
    expect(r.success).toBe(true)
  })

  it('parses a fully populated claude conversation with preview', () => {
    const r = ConversationSchema.safeParse({
      id: 'c-456',
      platform: 'claude',
      url: 'https://claude.ai/chat/c-456',
      title: 'Rust ownership',
      spaceId: 's1',
      tags: ['rust', 'systems'],
      starred: true,
      note: 'good reference',
      capturedAt: 1000,
      platformUpdatedAt: 1500,
      messageCount: 12,
      preview: {
        firstUserMessage: 'Explain ownership',
        lastAssistantMessage: 'Ownership ensures…',
      },
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown platform', () => {
    const r = ConversationSchema.safeParse({
      id: 'a',
      platform: 'mistral',
      url: 'https://mistral.ai/x',
      title: 'T',
      tags: [],
      starred: false,
      capturedAt: 0,
    })
    expect(r.success).toBe(false)
  })

  it('rejects non-URL string for url', () => {
    const r = ConversationSchema.safeParse({
      id: 'a',
      platform: 'chatgpt',
      url: 'not-a-url',
      title: 'T',
      tags: [],
      starred: false,
      capturedAt: 0,
    })
    expect(r.success).toBe(false)
  })

  it('rejects missing required tags array', () => {
    const r = ConversationSchema.safeParse({
      id: 'a',
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/a',
      title: 'T',
      starred: false,
      capturedAt: 0,
    })
    expect(r.success).toBe(false)
  })
})

describe('MessageSchema', () => {
  it('parses each role variant', () => {
    for (const role of ['user', 'assistant', 'system', 'tool'] as const) {
      const r = MessageSchema.safeParse({
        id: `m-${role}`,
        conversationId: 'c1',
        role,
        content: 'hello',
        timestamp: 0,
      })
      expect(r.success).toBe(true)
    }
  })

  it('allows empty content (real exports may have empty messages)', () => {
    const r = MessageSchema.safeParse({
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      content: '',
      timestamp: 0,
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown role', () => {
    const r = MessageSchema.safeParse({
      id: 'm1',
      conversationId: 'c1',
      role: 'bot',
      content: 'hi',
      timestamp: 0,
    })
    expect(r.success).toBe(false)
  })

  it('rejects empty conversationId', () => {
    const r = MessageSchema.safeParse({
      id: 'm1',
      conversationId: '',
      role: 'user',
      content: 'hi',
      timestamp: 0,
    })
    expect(r.success).toBe(false)
  })
})

describe('AppSettingsSchema', () => {
  it('applies defaults when given empty object', () => {
    const r = AppSettingsSchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.theme).toBe('system')
      expect(r.data.language).toBe('en')
      expect(r.data.overlayShortcut).toBe('Meta+M')
      expect(r.data.managerShortcut).toBe('Meta+Shift+M')
      expect(r.data.lastZipImports).toEqual({})
    }
  })

  it('defaults newtabOverride to false', () => {
    const r = AppSettingsSchema.safeParse({})
    if (!r.success) throw new Error('parse failed')
    expect(r.data.newtabOverride).toBe(false)
  })

  it('accepts a fully specified settings object', () => {
    const r = AppSettingsSchema.safeParse({
      theme: 'dark',
      language: 'zh-CN',
      overlayShortcut: 'Ctrl+M',
      managerShortcut: 'Ctrl+Shift+M',
      lastZipImports: { chatgpt: 100, claude: 200 },
    })
    expect(r.success).toBe(true)
  })

  it('rejects invalid theme', () => {
    const r = AppSettingsSchema.safeParse({ theme: 'sepia' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid language', () => {
    const r = AppSettingsSchema.safeParse({ language: 'fr-FR' })
    expect(r.success).toBe(false)
  })
})
