import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import JSZip from 'jszip'
import { useAppStore } from '@/stores/app-store'
import * as db from '@/lib/db'
import chatgptSample from '../fixtures/chatgpt-export-sample.json'

// 每个 case 前清库 + 重置 store —— 与 app-store.test.ts 同样的 fake-indexeddb 收尾约定
beforeEach(async () => {
  await db.__resetForTest()
  await indexedDB.deleteDatabase('spacemind')
  useAppStore.setState({
    loaded: false,
    spaces: [],
    conversations: [],
    toasts: [],
    importing: false,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function makeChatGPTZip(): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('conversations.json', JSON.stringify(chatgptSample))
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('app-store.importFromZip', () => {
  it('imports conversations and messages from a ChatGPT zip into state', async () => {
    const buf = await makeChatGPTZip()
    await useAppStore.getState().load()

    const summary = await useAppStore.getState().importFromZip(buf)

    expect(summary.vendor).toBe('chatgpt')
    expect(summary.conversationsAdded).toBe(2)
    expect(summary.conversationsUpdated).toBe(0)
    expect(summary.messagesAdded).toBeGreaterThan(0)

    const state = useAppStore.getState()
    expect(state.conversations).toHaveLength(2)
    // import 成功后 importing 必须复位,UI 才能停掉进度
    expect(state.importing).toBe(false)
    // 应当推一条 info toast 通报结果
    const lastToast = state.toasts[state.toasts.length - 1]
    expect(lastToast?.kind).toBe('info')
    expect(lastToast?.text).toMatch(/chatgpt/)
  })

  it('flips importing=true while the action is in flight, then false on completion', async () => {
    const buf = await makeChatGPTZip()
    await useAppStore.getState().load()

    expect(useAppStore.getState().importing).toBe(false)

    // 不要 await:启动后立刻观察中间态
    const pending = useAppStore.getState().importFromZip(buf)

    // 中间态:由于 importFromZip 在第一行同步 set({importing:true}),
    // 此处一定能观察到 true。不依赖 microtask 调度顺序
    expect(useAppStore.getState().importing).toBe(true)

    await pending

    expect(useAppStore.getState().importing).toBe(false)
  })

  it('re-import preserves user metadata (spaceId, tags, starred, note)', async () => {
    const buf = await makeChatGPTZip()
    await useAppStore.getState().load()
    await useAppStore.getState().importFromZip(buf)

    const before = useAppStore.getState().conversations[0]!
    // 模拟用户在 UI 上把这条对话归到一个 space 并打标
    const userEdited = {
      ...before,
      spaceId: 'space-work',
      tags: ['needs-followup'],
      starred: true,
      note: 'check this later',
    }
    await db.putConversation(userEdited)

    // 再次导入同一份 zip(用户可能定期重新导出做增量同步)
    const buf2 = await makeChatGPTZip()
    const summary = await useAppStore.getState().importFromZip(buf2)

    expect(summary.conversationsAdded).toBe(0)
    expect(summary.conversationsUpdated).toBe(2)

    const after = useAppStore
      .getState()
      .conversations.find((c) => c.id === before.id)!
    // 用户字段必须保住,否则重新导入等于清空用户编辑成果
    expect(after.spaceId).toBe('space-work')
    expect(after.tags).toEqual(['needs-followup'])
    expect(after.starred).toBe(true)
    expect(after.note).toBe('check this later')
    // 平台字段允许被覆盖刷新
    expect(after.title).toBe(before.title)
  })

  it('on error: importing resets to false, error toast pushed, rethrows', async () => {
    const zip = new JSZip()
    zip.file('not-conversations.json', '[]')
    const badBuf = await zip.generateAsync({ type: 'arraybuffer' })

    await useAppStore.getState().load()

    await expect(useAppStore.getState().importFromZip(badBuf)).rejects.toThrow(
      /conversations\.json/
    )
    const state = useAppStore.getState()
    expect(state.importing).toBe(false)
    expect(state.toasts[state.toasts.length - 1]?.kind).toBe('error')
  })
})

describe('app-store.load with conversations', () => {
  it('load() populates conversations from IDB', async () => {
    // 直写一条到 IDB,模拟"上次会话已经导入过"的冷启动
    await db.putConversation({
      id: 'c-pre',
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/c-pre',
      title: 'Preexisting',
      tags: [],
      starred: false,
      capturedAt: 100,
    })

    await useAppStore.getState().load()

    const state = useAppStore.getState()
    expect(state.loaded).toBe(true)
    expect(state.conversations.map((c) => c.id)).toEqual(['c-pre'])
  })
})
