// chat.mistral.ai content script
import { sendRuntimeMessage } from '@/lib/runtime-messages'
import { ensureOverlayMounted } from '@/lib/overlay/mount'
import { subscribeMistralSidebar } from '@/lib/sidebar-scrape/mistral'

export default defineContentScript({
  matches: ['https://chat.mistral.ai/*'],
  runAt: 'document_idle',
  main() {
    ensureOverlayMounted()

    let timer: number | null = null
    subscribeMistralSidebar((convs) => {
      if (convs.length === 0) return
      if (timer !== null) clearTimeout(timer)
      timer = window.setTimeout(() => {
        void sendRuntimeMessage({
          kind: 'conversations:batch-upsert',
          platform: 'mistral',
          conversations: convs,
        })
      }, 800)
    })
  },
})
