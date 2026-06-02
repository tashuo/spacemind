import type { ScrapedConversation } from '../runtime-messages'
import { type ScrapeConfig, scrapeByPattern, subscribeSidebar } from './utils'

// ChatGPT 的会话路径固定 /c/<id>;只匹配 word + dash 避免被 query string 污染
export const CHATGPT_CONFIG: ScrapeConfig = {
  hrefPattern: /^\/c\/([\w-]+)/,
  buildUrl: (id) => `https://chatgpt.com/c/${id}`,
}

export function scrapeChatGPTSidebar(doc: Document = document): ScrapedConversation[] {
  return scrapeByPattern(doc, CHATGPT_CONFIG)
}

export function subscribeChatGPTSidebar(
  onUpdate: (convs: ScrapedConversation[]) => void,
): () => void {
  return subscribeSidebar(CHATGPT_CONFIG, onUpdate)
}
