import { z } from 'zod'

// 调色板 key 严格收敛 —— UI 按这套 key 查 Tailwind 配色表,新增颜色需同步改 ui-utils
export const PaletteKeySchema = z.enum([
  'indigo',
  'emerald',
  'amber',
  'pink',
  'violet',
  'cyan',
])
export type PaletteKey = z.infer<typeof PaletteKeySchema>

// 平台 enum 只放当前支持的两家,未来加 gemini/mistral 必须显式升 schema
export const PlatformSchema = z.enum(['chatgpt', 'claude'])
export type Platform = z.infer<typeof PlatformSchema>

// 与主流 LLM API 一致的四种 role,避免后续解析 tool 调用时再补类型
export const RoleSchema = z.enum(['user', 'assistant', 'system', 'tool'])
export type Role = z.infer<typeof RoleSchema>

export const SpaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().max(8).optional(),
  note: z.string().max(500).optional(),
  color: PaletteKeySchema,
  pinned: z.boolean().optional(),
  sortIndex: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type Space = z.infer<typeof SpaceSchema>

export const ConversationSchema = z.object({
  id: z.string().min(1),
  platform: PlatformSchema,
  url: z.string().url(),
  title: z.string(),
  spaceId: z.string().optional(),
  tags: z.array(z.string()),
  starred: z.boolean(),
  note: z.string().optional(),
  capturedAt: z.number(),
  platformUpdatedAt: z.number().optional(),
  messageCount: z.number().optional(),
  preview: z
    .object({
      firstUserMessage: z.string().optional(),
      lastAssistantMessage: z.string().optional(),
    })
    .optional(),
})
export type Conversation = z.infer<typeof ConversationSchema>

export const MessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  role: RoleSchema,
  content: z.string(),  // empty allowed: real exports may contain empty messages (tool turns, aborts)
  timestamp: z.number(),
})
export type Message = z.infer<typeof MessageSchema>

export const AppSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  language: z.enum(['en', 'zh-CN']).default('en'),
  overlayShortcut: z.string().default('Meta+M'),
  managerShortcut: z.string().default('Meta+Shift+M'),
  newtabOverride: z.boolean().default(false),
  lastZipImports: z
    .object({
      chatgpt: z.number().optional(),
      claude: z.number().optional(),
    })
    .default({}),
})
export type AppSettings = z.infer<typeof AppSettingsSchema>
