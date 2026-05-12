import { z } from 'zod'
import {
  ConversationSchema,
  MessageSchema,
  SpaceSchema,
  type Conversation,
  type Message,
  type Space,
} from './schema'

// SpaceMind 自家的 JSON 备份格式 —— 与 zip-import(ChatGPT/Claude 原始导出)是两套东西。
// formatVersion 写死 1;未来格式破坏式变更必须升号,并在 parseImport 里分支兼容。
export const ExportFileSchema = z.object({
  format: z.literal('spacemind-export'),
  formatVersion: z.literal(1),
  app: z.literal('SpaceMind'),
  exportedAt: z.number(),
  spaces: z.array(SpaceSchema),
  conversations: z.array(ConversationSchema),
  messages: z.array(MessageSchema),
})
export type ExportFile = z.infer<typeof ExportFileSchema>

export interface ExportInput {
  spaces: Space[]
  conversations: Conversation[]
  messages: Message[]
}

export function serializeForExport(
  input: ExportInput,
  now: number = Date.now(),
): string {
  const payload: ExportFile = {
    format: 'spacemind-export',
    formatVersion: 1,
    app: 'SpaceMind',
    exportedAt: now,
    spaces: input.spaces,
    conversations: input.conversations,
    messages: input.messages,
  }
  return JSON.stringify(payload, null, 2)
}

export type ParseResult =
  | { ok: true; file: ExportFile }
  | { ok: false; reason: 'invalid-json' | 'invalid-shape' }

export function parseImport(raw: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'invalid-json' }
  }
  const result = ExportFileSchema.safeParse(parsed)
  if (!result.success) return { ok: false, reason: 'invalid-shape' }
  return { ok: true, file: result.data }
}

export function exportFilename(now: number = Date.now()): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `spacemind-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`
}

/**
 * 合并 Space:同 id 时保留用户元数据(emoji/note/pinned/sortIndex/createdAt),
 * 用 incoming 覆盖 name/color/updatedAt —— 与导入对话时"用户字段保留,
 * 平台字段刷新"的语义保持一致。新增项原样插入。
 */
export function mergeSpace(existing: Space | undefined, incoming: Space): Space {
  if (!existing) return incoming
  return {
    ...incoming,
    emoji: existing.emoji,
    note: existing.note,
    pinned: existing.pinned,
    sortIndex: existing.sortIndex,
    createdAt: existing.createdAt,
  }
}

/**
 * 合并 Conversation:同 id 保留 spaceId / tags / starred / note / capturedAt,
 * 覆盖平台层 title / url / preview / messageCount / platformUpdatedAt / platform。
 */
export function mergeConversation(
  existing: Conversation | undefined,
  incoming: Conversation,
): Conversation {
  if (!existing) return incoming
  return {
    ...incoming,
    spaceId: existing.spaceId,
    tags: existing.tags,
    starred: existing.starred,
    note: existing.note,
    capturedAt: existing.capturedAt,
  }
}

// ---- 副作用工具(浏览器 API,不进单测)----

export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 给浏览器一点时间触发下载;过早 revoke 会让 Safari 等取消下载。
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function pickJsonFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    input.style.opacity = '0'

    let settled = false
    const cleanup = () => {
      if (input.parentNode) document.body.removeChild(input)
    }
    const finish = (value: File | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      finish(file ?? null)
    })

    // 现代浏览器原生 cancel 事件(Chrome 113+ / Firefox 91+);取消时直接收到
    input.addEventListener('cancel', () => finish(null))

    document.body.appendChild(input)
    // 必须在用户点击的同一同步链上调用,才能通过浏览器的 user-activation 检查
    input.click()
  })
}
