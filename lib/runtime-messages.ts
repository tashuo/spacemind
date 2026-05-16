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
    // 容忍单行损坏:整体 array 不一刀切,而是按行 safeParse,扔掉坏行保留好行。
    // 否则一条非法 Space(比如旧版本残留、name 空串)会让整个 reply 失效,
    // overlay 永远显示"No spaces yet",但 manager 因为不 parse 仍然能看到所有空间
    spaces: z.array(z.unknown()).transform((arr) =>
      arr.flatMap((item) => {
        const r = SpaceSchema.safeParse(item)
        return r.success ? [r.data] : []
      }),
    ),
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
// 这样 background 即便回了脏数据,调用方也只会拿到 undefined 而不是运行时炸掉。
// sendMessage 在 SW 没活、对方不存在时会 reject,这里 catch 住返回 undefined ——
// 调用方都做了 reply 为空的 fallback,没必要把异常往上冒。
export async function sendRuntimeMessage<T extends RuntimeMessage>(
  msg: T,
): Promise<RuntimeMessage | undefined> {
  let raw: unknown
  try {
    raw = await chrome.runtime.sendMessage(msg)
  } catch (e) {
    console.warn('[SpaceMind] sendRuntimeMessage failed:', msg.kind, e)
    return undefined
  }
  // background 对部分 kind 显式 return undefined(如 batch-upsert 这种 fire-and-forget)。
  // Chrome 跨进程 sendResponse(undefined) 会被序列化成 null —— 都视为"无回包"
  if (raw === undefined || raw === null) return undefined
  const parsed = RuntimeMessageSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(
      '[SpaceMind] reply parse failed for',
      msg.kind,
      parsed.error.issues,
      raw,
    )
    return undefined
  }
  return parsed.data
}
