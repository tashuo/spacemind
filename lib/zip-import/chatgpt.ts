import type { Conversation, Message } from '../schema'

interface MappingNode {
  id: string
  message: {
    id: string
    author: { role: string }
    content: { content_type: string; parts: unknown[] }
    create_time: number | null
  } | null
  parent: string | null
  children: string[]
}

interface RawChatGPTConv {
  title: string
  create_time: number // epoch seconds
  update_time: number
  conversation_id: string
  current_node: string
  mapping: Record<string, MappingNode>
}

export function parseChatGPTExport(
  raw: RawChatGPTConv[],
): { conversations: Conversation[]; messages: Message[] } {
  const now = Date.now()
  const conversations: Conversation[] = []
  const messages: Message[] = []

  for (const c of raw) {
    const thread = walkCurrentPath(c)
    if (thread.length === 0) continue // 无消息时跳过,避免空对话污染列表

    const convId = c.conversation_id
    const firstUser = thread.find((m) => m.role === 'user')?.content
    const lastAssistant = [...thread].reverse().find((m) => m.role === 'assistant')?.content

    const conv: Conversation = {
      id: convId,
      platform: 'chatgpt',
      url: `https://chatgpt.com/c/${convId}`,
      title: c.title,
      tags: [],
      starred: false,
      capturedAt: now,
      platformUpdatedAt: Math.round(c.update_time * 1000),
      messageCount: thread.length,
      preview: {
        ...(firstUser !== undefined ? { firstUserMessage: truncate(firstUser, 200) } : {}),
        ...(lastAssistant !== undefined
          ? { lastAssistantMessage: truncate(lastAssistant, 200) }
          : {}),
      },
    }
    conversations.push(conv)

    for (const m of thread) {
      messages.push({
        id: `${convId}:${m.id}`, // 复合 ID,保证跨对话唯一
        conversationId: convId,
        role: m.role,
        content: m.content,
        timestamp: Math.round((m.timestamp ?? 0) * 1000),
      })
    }
  }

  return { conversations, messages }
}

// 从 current_node 向 root 回溯,再 reverse 得到 root → leaf 顺序
function walkCurrentPath(c: RawChatGPTConv): Array<{
  id: string
  role: Message['role']
  content: string
  timestamp: number | null
}> {
  const path: Array<{
    id: string
    role: Message['role']
    content: string
    timestamp: number | null
  }> = []
  let cursor: string | null = c.current_node
  const seen = new Set<string>() // 防御性 cycle guard
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    const node: MappingNode | undefined = c.mapping[cursor]
    if (!node) break
    if (node.message) {
      const role = normalizeRole(node.message.author.role)
      const content = extractText(node.message.content)
      if (role && content !== null) {
        path.push({
          id: node.message.id,
          role,
          content,
          timestamp: node.message.create_time,
        })
      }
    }
    cursor = node.parent
  }
  return path.reverse()
}

function normalizeRole(raw: string): Message['role'] | null {
  if (raw === 'user' || raw === 'assistant' || raw === 'system' || raw === 'tool') return raw
  return null
}

function extractText(
  content: { content_type: string; parts: unknown[] } | null,
): string | null {
  if (!content) return null
  if (content.content_type !== 'text') return null
  return content.parts.filter((p): p is string => typeof p === 'string').join('\n')
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}
