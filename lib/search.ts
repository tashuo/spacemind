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

// FlexSearch 默认 encoder 不切 CJK,整段中文会被当成一个 token,叠加 forward tokenize
// 后只能从开头匹配。这里自定义 encoder:拉丁/数字按词切(配合 forward 仍能前缀命中),
// CJK 逐字成独立 token(单字 + forward = 单字本身)。
// 代价:中文丢字序——搜「开端」也会命中「前端开发」,个人搜索场景可接受。
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const WORD_BREAK = /[\s\p{P}\p{S}]/u

function encodeMixed(str: string): string[] {
  const tokens: string[] = []
  let buf = ''
  const flush = () => {
    if (buf) {
      tokens.push(buf.toLowerCase())
      buf = ''
    }
  }
  for (const ch of str) {
    if (CJK.test(ch)) {
      flush()
      tokens.push(ch)
    } else if (WORD_BREAK.test(ch)) {
      flush()
    } else {
      buf += ch
    }
  }
  flush()
  return tokens
}

// 两套独立 Index:一套用 title+preview 拼接文本,一套覆盖全体消息正文。
// 之所以分两套而非合并:title 命中应优先于 message 命中,合并索引就无法保留这一信号。
export function createSearchIndex(input: {
  conversations: Conversation[]
  messages: Message[]
}): SearchIndex {
  const titleIdx = new FlexSearch.Index({ tokenize: 'forward', encode: encodeMixed, cache: true })
  const messageIdx = new FlexSearch.Index({ tokenize: 'forward', encode: encodeMixed, cache: true })

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
