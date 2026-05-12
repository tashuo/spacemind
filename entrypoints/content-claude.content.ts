// Phase 3 Task 1 scaffold —— 仅打印一行,确认内容脚本能注入 claude.ai。
// 后续 Task 在此挂载 overlay + 订阅 sidebar 抓取。
export default defineContentScript({
  matches: ['https://claude.ai/*'],
  runAt: 'document_idle',
  main() {
    console.log('[SpaceMind] content script loaded on claude.ai')
  },
})
