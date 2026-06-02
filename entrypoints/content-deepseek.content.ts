// chat.deepseek.com content script
import { sendRuntimeMessage } from '@/lib/runtime-messages'
import { ensureOverlayMounted } from '@/lib/overlay/mount'
import { subscribeDeepSeekSidebar } from '@/lib/sidebar-scrape/deepseek'

export default defineContentScript({
  matches: ['https://chat.deepseek.com/*'],
  runAt: 'document_idle',
  main() {
    ensureOverlayMounted()

    let timer: number | null = null
    subscribeDeepSeekSidebar((convs) => {
      if (convs.length === 0) return
      if (timer !== null) clearTimeout(timer)
      timer = window.setTimeout(() => {
        void sendRuntimeMessage({
          kind: 'conversations:batch-upsert',
          platform: 'deepseek',
          conversations: convs,
        })
      }, 800)
    })
  },
})
