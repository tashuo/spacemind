// gemini.google.com content script —— 镜像 chatgpt 版本,差别只在 sidebar scraper
import { sendRuntimeMessage } from '@/lib/runtime-messages'
import { ensureOverlayMounted } from '@/lib/overlay/mount'
import { subscribeGeminiSidebar } from '@/lib/sidebar-scrape/gemini'

export default defineContentScript({
  matches: ['https://gemini.google.com/*'],
  runAt: 'document_idle',
  main() {
    ensureOverlayMounted()

    let timer: number | null = null
    subscribeGeminiSidebar((convs) => {
      if (convs.length === 0) return
      if (timer !== null) clearTimeout(timer)
      timer = window.setTimeout(() => {
        void sendRuntimeMessage({
          kind: 'conversations:batch-upsert',
          platform: 'gemini',
          conversations: convs,
        })
      }, 800)
    })
  },
})
