import type { ScrapedConversation } from '../runtime-messages'
import { type ScrapeConfig, scrapeByPattern, subscribeSidebar } from './utils'

// DeepSeek 会话 URL 常见两种:/a/chat/s/<id> 或 /chat/<id>。
// 这里用宽松 pattern,优先匹配长路径,fallback 到短路径
export const DEEPSEEK_CONFIG: ScrapeConfig = {
  hrefPattern: /^\/(?:a\/chat\/s|chat)\/([\w-]+)/,
  buildUrl: (id) => `https://chat.deepseek.com/a/chat/s/${id}`,
}

export function scrapeDeepSeekSidebar(doc: Document = document): ScrapedConversation[] {
  return scrapeByPattern(doc, DEEPSEEK_CONFIG)
}

export function subscribeDeepSeekSidebar(
  onUpdate: (convs: ScrapedConversation[]) => void,
): () => void {
  return subscribeSidebar(DEEPSEEK_CONFIG, onUpdate)
}
