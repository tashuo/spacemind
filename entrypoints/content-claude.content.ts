// claude.ai content script —— 镜像 chatgpt 版本,差别只在 sidebar scraper 来源
import { sendRuntimeMessage } from '@/lib/runtime-messages'
import { ensureOverlayMounted } from '@/lib/overlay/mount'
import { subscribeClaudeSidebar } from '@/lib/sidebar-scrape/claude'

export default defineContentScript({
  matches: ['https://claude.ai/*'],
  runAt: 'document_idle',
  main() {
    ensureOverlayMounted()

    // 同 chatgpt 版本:debounce 800ms 合并连续 mutation;空列表(尚未加载)直接跳过
    let timer: number | null = null
    subscribeClaudeSidebar((convs) => {
      if (convs.length === 0) return
      if (timer !== null) clearTimeout(timer)
      timer = window.setTimeout(() => {
        void sendRuntimeMessage({
          kind: 'conversations:batch-upsert',
          platform: 'claude',
          conversations: convs,
        })
      }, 800)
    })
  },
})
