import type { Conversation, Message } from '../schema'

interface RawClaudeMessage {
  uuid: string
  text: string
  sender: 'human' | 'assistant' | string
  created_at: string // ISO 8601
}

interface RawClaudeConv {
  uuid: string
  name: string
  created_at: string
  updated_at: string
  chat_messages: RawClaudeMessage[]
}

export function parseClaudeExport(
  raw: RawClaudeConv[],
): { conversations: Conversation[]; messages: Message[] } {
  const now = Date.now()
  const conversations: Conversation[] = []
  const messages: Message[] = []

  for (const c of raw) {
    const convId = c.uuid
    const msgs = (c.chat_messages ?? []).map((m) => normalizeMessage(convId, m))

    const firstUser = msgs.find((m) => m.role === 'user')?.content
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')?.content

    conversations.push({
      id: convId,
      platform: 'claude',
      url: `https://claude.ai/chat/${convId}`,
      title: c.name,
      tags: [],
      starred: false,
      capturedAt: now,
      platformUpdatedAt: Date.parse(c.updated_at),
      messageCount: msgs.length,
      preview: {
        ...(firstUser !== undefined ? { firstUserMessage: truncate(firstUser, 200) } : {}),
        ...(lastAssistant !== undefined
          ? { lastAssistantMessage: truncate(lastAssistant, 200) }
          : {}),
      },
    })

    messages.push(...msgs)
  }
  return { conversations, messages }
}

function normalizeMessage(convId: string, m: RawClaudeMessage): Message {
  return {
    id: `${convId}:${m.uuid}`, // 复合 ID,跨对话唯一
    conversationId: convId,
    role: m.sender === 'human' ? 'user' : m.sender === 'assistant' ? 'assistant' : 'system',
    content: m.text ?? '',
    timestamp: Date.parse(m.created_at),
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}
