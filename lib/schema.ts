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

// 支持的平台列表。新增一家:
//   1) 这里加 enum
//   2) lib/sidebar-scrape/ 加 config
//   3) entrypoints/content-<name>.content.ts 加内容脚本
//   4) Overlay.tsx 加 detectPlatform + currentConversation 分支
//   5) conversation-row.tsx 加 PLATFORM_ABBR + PLATFORM_STYLE
//   6) wxt.config.ts 加 host_permissions
//   7) lib/i18n.ts 加 platformX 文案
export const PlatformSchema = z.enum(['chatgpt', 'claude', 'gemini', 'deepseek', 'mistral'])
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
  // 用户手动拖拽排序后的位置;升序展示(0 = 顶部)。
  // 没拖过的对话不写这个字段,UI 排序时会把它们放在已排过的后面、按时间继续排
  sortIndex: z.number().optional(),
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
