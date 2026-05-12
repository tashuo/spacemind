// Service worker — Phase 1 只接管「点工具栏图标 → 打开 manager」这一件事。
// 后续阶段会在此处接入 content-script 通信、快捷键、capture flow 等。
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
})
