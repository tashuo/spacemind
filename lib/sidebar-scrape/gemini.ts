import type { ScrapedConversation } from '../runtime-messages'
import { type ScrapeConfig, scrapeByPattern, subscribeSidebar } from './utils'

// Gemini 会话 URL 形如 /app/<convId> —— convId 一般是十六进制串
// (DOM 实际选择器还未在真实站验证,如果 sidebar 用 button 而非 anchor 渲染,需要换抓法)
export const GEMINI_CONFIG: ScrapeConfig = {
  hrefPattern: /^\/app\/([\w-]+)/,
  buildUrl: (id) => `https://gemini.google.com/app/${id}`,
}

export function scrapeGeminiSidebar(doc: Document = document): ScrapedConversation[] {
  return scrapeByPattern(doc, GEMINI_CONFIG)
}

export function subscribeGeminiSidebar(
  onUpdate: (convs: ScrapedConversation[]) => void,
): () => void {
  return subscribeSidebar(GEMINI_CONFIG, onUpdate)
}
