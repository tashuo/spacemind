import type { ScrapedConversation } from '../runtime-messages'

// ChatGPT 的会话路径格式固定是 /c/<id>;只匹配 word + dash,避免被 query string 污染
const CONV_HREF = /^\/c\/([\w-]+)/

export function scrapeChatGPTSidebar(doc: Document = document): ScrapedConversation[] {
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href^="/c/"]'))
  // 同一会话在 DOM 里可能因为虚拟列表 / hover preview 出现多个 anchor,这里靠 id 去重
  const seen = new Set<string>()
  const result: ScrapedConversation[] = []
  for (const a of anchors) {
    const match = CONV_HREF.exec(a.getAttribute('href') ?? '')
    if (!match) continue
    const id = match[1]
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push({
      id,
      url: `https://chatgpt.com/c/${id}`,
      // 兜底用 id 当 title,避免下游写一个空字符串导致管理页显示空白
      title: (a.textContent ?? '').trim() || id,
    })
  }
  return result
}

// content script 在 main() 里订阅一次,sidebar 任意子树变化都重新跑一遍 scrape;
// happy-dom 的 MutationObserver 实现不稳,这层不做单测,留给 Task 7 的手动 e2e
export function subscribeChatGPTSidebar(
  onUpdate: (convs: ScrapedConversation[]) => void,
): () => void {
  const fire = () => onUpdate(scrapeChatGPTSidebar(document))
  fire()
  const observer = new MutationObserver(() => fire())
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
