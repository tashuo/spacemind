// chatgpt.com content script —— 挂载 Shadow DOM overlay + 订阅 sidebar 变化做静默 upsert。
// 业务逻辑都在 lib/overlay 和 lib/sidebar-scrape,本文件只做事件路由。
import { sendRuntimeMessage } from '@/lib/runtime-messages'
import { ensureOverlayMounted } from '@/lib/overlay/mount'
import { subscribeChatGPTSidebar } from '@/lib/sidebar-scrape/chatgpt'

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  runAt: 'document_idle',
  main() {
    ensureOverlayMounted()

    // sidebar 任意子树变动都会触发 onUpdate;ChatGPT 拖滚条加载更多时会一秒内连续触发多次,
    // 800ms debounce 避免每次都打 IPC + IDB 事务
    let timer: number | null = null
    subscribeChatGPTSidebar((convs) => {
      if (convs.length === 0) return
      if (timer !== null) clearTimeout(timer)
      timer = window.setTimeout(() => {
        void sendRuntimeMessage({
          kind: 'conversations:batch-upsert',
          platform: 'chatgpt',
          conversations: convs,
        })
      }, 800)
    })
  },
})
