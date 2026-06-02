import type { ScrapedConversation } from '../runtime-messages'
import { type ScrapeConfig, scrapeByPattern, subscribeSidebar } from './utils'

// Mistral le chat URL 形如 /chat/<uuid>
export const MISTRAL_CONFIG: ScrapeConfig = {
  hrefPattern: /^\/chat\/([\w-]+)/,
  buildUrl: (id) => `https://chat.mistral.ai/chat/${id}`,
}

export function scrapeMistralSidebar(doc: Document = document): ScrapedConversation[] {
  return scrapeByPattern(doc, MISTRAL_CONFIG)
}

export function subscribeMistralSidebar(
  onUpdate: (convs: ScrapedConversation[]) => void,
): () => void {
  return subscribeSidebar(MISTRAL_CONFIG, onUpdate)
}
