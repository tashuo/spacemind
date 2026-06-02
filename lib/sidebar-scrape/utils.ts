import type { ScrapedConversation } from '../runtime-messages'

// 各家平台的 sidebar scrape 走同一套套路:扫 anchor → 用 regex 抽 id → 拼 url。
// 这里抽出共用骨架,各平台只需要给一个 config 即可,避免每加一家就复制 30 行。
export interface ScrapeConfig {
  /** anchor 的 href 命中此 regex 才算 conversation;match[1] 视为 conversation id */
  hrefPattern: RegExp
  /** id → 绝对 url 的拼接(用于 Conversation.url) */
  buildUrl: (id: string) => string
}

export function scrapeByPattern(
  doc: Document,
  cfg: ScrapeConfig,
): ScrapedConversation[] {
  // 这些平台的 sidebar 都是虚拟列表 + hover preview,同一会话可能出现多次 anchor;
  // 靠 id 去重保留首次出现的 text(通常是真正的对话标题)
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'))
  const seen = new Set<string>()
  const result: ScrapedConversation[] = []
  for (const a of anchors) {
    const match = cfg.hrefPattern.exec(a.getAttribute('href') ?? '')
    if (!match) continue
    const id = match[1]
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push({
      id,
      url: cfg.buildUrl(id),
      // 兜底用 id 当 title,避免下游写空字符串导致 UI 显示空白
      title: (a.textContent ?? '').trim() || id,
    })
  }
  return result
}

// content script 调用一次,sidebar 任何子树变化都重新跑一遍 scrape;
// MutationObserver 在 happy-dom 不稳,这层逻辑不做单测,留给手动 e2e
export function subscribeSidebar(
  cfg: ScrapeConfig,
  onUpdate: (convs: ScrapedConversation[]) => void,
): () => void {
  const fire = () => onUpdate(scrapeByPattern(document, cfg))
  fire()
  const observer = new MutationObserver(() => fire())
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
