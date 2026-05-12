// Service worker —— 单一 IDB 写入入口。
// Phase 1:点工具栏图标 → 打开 manager。
// Phase 3:chrome.commands 触发 overlay,以及把 content script / overlay 的请求路由到 lib/db。
import { RuntimeMessageSchema, type RuntimeMessage } from '@/lib/runtime-messages'
import type { Conversation } from '@/lib/schema'
// namespace 导入,便于测试 spy;也和 stores/app-store 风格一致
import * as db from '@/lib/db'

export default defineBackground(() => {
  chrome.action.onClicked.addListener(async () => {
    const url = chrome.runtime.getURL('manager.html')
    // 已经有 manager tab → 切过去而不是开新的,避免一堆重复
    const existing = await chrome.tabs.query({ url })
    const first = existing[0]
    if (first && typeof first.id === 'number') {
      await chrome.tabs.update(first.id, { active: true })
      if (typeof first.windowId === 'number') {
        await chrome.windows.update(first.windowId, { focused: true })
      }
      return
    }
    await chrome.tabs.create({ url })
  })

  // Cmd+Shift+J (mac) / Ctrl+Shift+J 触发:让活动 tab 里的 content script 自己切换 overlay。
  // 这个 message 走 chrome.tabs.sendMessage(SW → CS),是 content-script-internal,不进 RuntimeMessageSchema。
  chrome.commands.onCommand.addListener(async (cmd, tab) => {
    if (cmd !== 'open-overlay') return
    if (!tab || typeof tab.id !== 'number') return
    try {
      await chrome.tabs.sendMessage(tab.id, { kind: 'overlay:toggle' })
    } catch {
      // 当前页没有匹配的 content script(非 chatgpt.com / claude.ai)—— 静默忽略
    }
  })

  // 所有 content / overlay 发到 background 的请求,先过 Zod 再 dispatch。
  // 返回 true 把 sendResponse 通道挂起,等异步 handle 完了再回包。
  chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const parsed = RuntimeMessageSchema.safeParse(raw)
    if (!parsed.success) return false
    void handle(parsed.data).then(sendResponse)
    return true
  })

  async function handle(msg: RuntimeMessage): Promise<RuntimeMessage | undefined> {
    const now = Date.now()
    switch (msg.kind) {
      case 'spaces:list-request': {
        const spaces = await db.allSpaces()
        return { kind: 'spaces:list-reply', spaces }
      }
      case 'conversation:save-current': {
        const existing = await db.getConversation(msg.conversation.id)
        // 已有行:只动 spaceId / platformUpdatedAt,保留用户标签、星标、note、首次抓取时间
        const conv: Conversation = existing
          ? { ...existing, spaceId: msg.spaceId, platformUpdatedAt: now }
          : {
              id: msg.conversation.id,
              platform: msg.platform,
              url: msg.conversation.url,
              title: msg.conversation.title,
              spaceId: msg.spaceId,
              tags: [],
              starred: false,
              capturedAt: now,
              platformUpdatedAt: now,
            }
        try {
          await db.putConversation(conv)
          return { kind: 'conversation:save-reply', ok: true }
        } catch (e) {
          return {
            kind: 'conversation:save-reply',
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          }
        }
      }
      case 'conversations:batch-upsert': {
        // sidebar scraper 触发的 fire-and-forget,无需回包
        await db.bulkUpsertScrapedConversations(msg.platform, msg.conversations, now)
        return undefined
      }
      // reply 类型消息 background 不会收到,但 discriminated union 要求穷举
      case 'conversation:save-reply':
      case 'spaces:list-reply':
        return undefined
      default:
        return undefined
    }
  }
})
