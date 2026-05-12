import FlexSearch from 'flexsearch'
import type { Conversation, Message } from './schema'

// 命中来源标注 —— UI 可据此区分高亮策略(title 优先级最高)
export interface SearchHit {
  conversationId: string
  matchedIn: 'title' | 'preview' | 'message'
  score: number
}

export interface SearchIndex {
  query: (text: string) => SearchHit[]
}

// 两套独立 Index:一套用 title+preview 拼接文本,一套覆盖全体消息正文。
// 之所以分两套而非合并:title 命中应优先于 message 命中,合并索引就无法保留这一信号。
export function createSearchIndex(input: {
  conversations: Conversation[]
  messages: Message[]
}): SearchIndex {
  const titleIdx = new FlexSearch.Index({ tokenize: 'forward', cache: true })
  const messageIdx = new FlexSearch.Index({ tokenize: 'forward', cache: true })

  // FlexSearch 用数字 key 存储,这里维护数字 ↔ conversationId 的双向映射
  const titleKeyToConvId = new Map<number, string>()
  input.conversations.forEach((c, i) => {
    const text = [
      c.title,
      c.preview?.firstUserMessage ?? '',
      c.preview?.lastAssistantMessage ?? '',
    ]
      .filter(Boolean)
      .join(' \n ')
    titleIdx.add(i, text)
    titleKeyToConvId.set(i, c.id)
  })

  const messageKeyToConvId = new Map<number, string>()
  input.messages.forEach((m, i) => {
    messageIdx.add(i, m.content)
    messageKeyToConvId.set(i, m.conversationId)
  })

  return {
    query(text) {
      if (text.trim().length === 0) return []

      const titleHits = titleIdx.search(text, { limit: 50 }) as number[]
      const messageHits = messageIdx.search(text, { limit: 200 }) as number[]

      const seen = new Set<string>()
      const out: SearchHit[] = []

      // score 用单调递减计数器,只用来保序;真实的相关性已经反映在 FlexSearch 返回顺序里
      let score = 100
      for (const k of titleHits) {
        const convId = titleKeyToConvId.get(k)
        if (convId && !seen.has(convId)) {
          out.push({ conversationId: convId, matchedIn: 'title', score: score-- })
          seen.add(convId)
        }
      }
      for (const k of messageHits) {
        const convId = messageKeyToConvId.get(k)
        if (convId && !seen.has(convId)) {
          out.push({ conversationId: convId, matchedIn: 'message', score: score-- })
          seen.add(convId)
        }
      }
      return out
    },
  }
}
