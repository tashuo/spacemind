import type { ScrapedConversation } from '../runtime-messages'
import { type ScrapeConfig, scrapeByPattern, subscribeSidebar } from './utils'

// Claude 会话路径固定 /chat/<uuid>
export const CLAUDE_CONFIG: ScrapeConfig = {
  hrefPattern: /^\/chat\/([\w-]+)/,
  buildUrl: (id) => `https://claude.ai/chat/${id}`,
}

export function scrapeClaudeSidebar(doc: Document = document): ScrapedConversation[] {
  return scrapeByPattern(doc, CLAUDE_CONFIG)
}

export function subscribeClaudeSidebar(
  onUpdate: (convs: ScrapedConversation[]) => void,
): () => void {
  return subscribeSidebar(CLAUDE_CONFIG, onUpdate)
}
