import { z } from 'zod'
import { PlatformSchema, SpaceSchema } from './schema'

// content script 看不到完整 message body,只能拿 sidebar 上肉眼可见的 id/url/title,
// 故单独抽一个最小化的 ScrapedConversation,避免和 Conversation(IDB 行)耦合
export const ScrapedConversationSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  title: z.string(),
})
export type ScrapedConversation = z.infer<typeof ScrapedConversationSchema>

// 所有 background ↔ content ↔ overlay 之间的消息走一个 discriminated union,
// 把 request 和 reply 都放在同一个 union 里,接收端可以靠 kind 直接 pattern match
export const RuntimeMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('conversation:save-current'),
    platform: PlatformSchema,
    conversation: ScrapedConversationSchema,
    spaceId: z.string(),
  }),
  z.object({
    kind: z.literal('conversation:save-reply'),
    ok: z.boolean(),
    error: z.string().optional(),
  }),
  z.object({ kind: z.literal('spaces:list-request') }),
  z.object({
    kind: z.literal('spaces:list-reply'),
    spaces: z.array(SpaceSchema),
  }),
  z.object({
    kind: z.literal('conversations:batch-upsert'),
    platform: PlatformSchema,
    conversations: z.array(ScrapedConversationSchema),
  }),
  // background → 所有 manager tab 的广播,告诉用户「刚把 N 条新对话收进 Unsorted」
  z.object({
    kind: z.literal('conversations:scraped'),
    platform: PlatformSchema,
    added: z.number(),
    updated: z.number(),
  }),
])
export type RuntimeMessage = z.infer<typeof RuntimeMessageSchema>

// 统一的 sender helper:发送端拿到的 chrome.runtime 回包再过一遍 schema,
// 这样 background 即便回了脏数据,调用方也只会拿到 undefined 而不是运行时炸掉
export async function sendRuntimeMessage<T extends RuntimeMessage>(
  msg: T,
): Promise<RuntimeMessage | undefined> {
  const raw = await chrome.runtime.sendMessage(msg)
  if (raw === undefined) return undefined
  const parsed = RuntimeMessageSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}
