import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { useAppStore } from '@/stores/app-store'
import * as db from '@/lib/db'

// 每个 case 前清库 + 重置 store —— 避免 idb 拿着旧句柄、store 残留上一个 case 的 spaces。
// 先 close 老连接再 deleteDatabase,否则 fake-indexeddb 会卡在 versionchange。
beforeEach(async () => {
  await db.__resetForTest()
  await indexedDB.deleteDatabase('spacemind')
  useAppStore.setState({ loaded: false, spaces: [], toasts: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('app-store.load', () => {
  it('flips loaded=true and reads empty spaces from IDB', async () => {
    await useAppStore.getState().load()
    expect(useAppStore.getState().loaded).toBe(true)
    expect(useAppStore.getState().spaces).toEqual([])
  })

  it('reads previously written spaces into state, sorted', async () => {
    await db.putSpace({
      id: 'a',
      name: 'Alpha',
      color: 'indigo',
      createdAt: 1,
      updatedAt: 100,
    })
    await db.putSpace({
      id: 'b',
      name: 'Beta',
      color: 'emerald',
      createdAt: 2,
      updatedAt: 200,
    })
    await useAppStore.getState().load()
    expect(useAppStore.getState().loaded).toBe(true)
    // updatedAt 降序兜底 → b 在前
    expect(useAppStore.getState().spaces.map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('on read failure: keeps loaded=false and pushes an error toast', async () => {
    vi.spyOn(db, 'allSpaces').mockRejectedValueOnce(new Error('boom'))
    await useAppStore.getState().load()
    // load 失败不回滚状态,但也不应当假装加载完毕 —— UI 才有机会重试
    expect(useAppStore.getState().loaded).toBe(false)
    expect(useAppStore.getState().toasts).toHaveLength(1)
    expect(useAppStore.getState().toasts[0]?.kind).toBe('error')
  })
})

describe('app-store.createSpace', () => {
  it('optimistically adds and returns the new id', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(useAppStore.getState().spaces.map((s) => s.name)).toEqual(['Work'])
  })

  it('persists across loads', async () => {
    await useAppStore.getState().load()
    await useAppStore.getState().createSpace('Work', 'indigo')
    // 模拟下一次冷启动:清掉 store 内存,重新从 IDB 读
    useAppStore.setState({ loaded: false, spaces: [] })
    await useAppStore.getState().load()
    expect(useAppStore.getState().spaces.map((s) => s.name)).toEqual(['Work'])
  })

  it('rolls back optimistic add if IDB write fails', async () => {
    await useAppStore.getState().load()
    vi.spyOn(db, 'putSpace').mockRejectedValueOnce(new Error('disk full'))

    await expect(
      useAppStore.getState().createSpace('Work', 'indigo')
    ).rejects.toThrow()

    // 乐观插入必须被回滚 —— UI 不能留下一个"幽灵 space"
    expect(useAppStore.getState().spaces).toEqual([])
    expect(useAppStore.getState().toasts).toHaveLength(1)
    expect(useAppStore.getState().toasts[0]?.kind).toBe('error')
  })
})

describe('app-store.renameSpace', () => {
  it('renames an existing space and bumps updatedAt', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Old', 'indigo')
    const beforeUpdatedAt = useAppStore.getState().spaces[0]!.updatedAt

    // 拉开时钟,确保 updatedAt 一定向前推进
    await new Promise((r) => setTimeout(r, 2))

    await useAppStore.getState().renameSpace(id, 'New')
    const renamed = useAppStore.getState().spaces.find((s) => s.id === id)
    expect(renamed?.name).toBe('New')
    expect(renamed?.updatedAt).toBeGreaterThanOrEqual(beforeUpdatedAt)
  })

  it('is a no-op when the id is unknown (no throw, no state change)', async () => {
    await useAppStore.getState().load()
    await useAppStore.getState().renameSpace('does-not-exist', 'whatever')
    expect(useAppStore.getState().spaces).toEqual([])
  })

  it('rolls back if IDB write fails', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Old', 'indigo')
    const snapshot = useAppStore.getState().spaces

    vi.spyOn(db, 'putSpace').mockRejectedValueOnce(new Error('boom'))
    await expect(
      useAppStore.getState().renameSpace(id, 'New')
    ).rejects.toThrow()

    expect(useAppStore.getState().spaces).toEqual(snapshot)
  })
})

describe('app-store.removeSpace', () => {
  it('removes the space from state and IDB', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    expect(useAppStore.getState().spaces).toHaveLength(1)

    await useAppStore.getState().removeSpace(id)
    expect(useAppStore.getState().spaces).toEqual([])

    // IDB 也要清干净 —— 下次 load 不应再看到它
    useAppStore.setState({ loaded: false, spaces: [] })
    await useAppStore.getState().load()
    expect(useAppStore.getState().spaces).toEqual([])
  })

  it('rolls back if IDB delete fails', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    const snapshot = useAppStore.getState().spaces

    vi.spyOn(db, 'deleteSpace').mockRejectedValueOnce(new Error('boom'))
    await expect(useAppStore.getState().removeSpace(id)).rejects.toThrow()

    expect(useAppStore.getState().spaces).toEqual(snapshot)
  })
})

describe('app-store.pushToast / dismissToast', () => {
  it('pushToast adds a toast with monotonically increasing id', () => {
    useAppStore.getState().pushToast('info', 'one')
    useAppStore.getState().pushToast('error', 'two')
    const toasts = useAppStore.getState().toasts
    expect(toasts).toHaveLength(2)
    expect(toasts[0]?.text).toBe('one')
    expect(toasts[1]?.text).toBe('two')
    expect(toasts[1]!.id).toBeGreaterThan(toasts[0]!.id)
  })

  it('dismissToast removes a toast by id', () => {
    useAppStore.getState().pushToast('info', 'keep')
    useAppStore.getState().pushToast('error', 'drop')
    const dropId = useAppStore.getState().toasts[1]!.id
    useAppStore.getState().dismissToast(dropId)
    expect(useAppStore.getState().toasts.map((t) => t.text)).toEqual(['keep'])
  })

  it('pushToast auto-dismisses after 4 seconds', () => {
    vi.useFakeTimers()
    useAppStore.getState().pushToast('info', 'temporary')
    expect(useAppStore.getState().toasts).toHaveLength(1)

    vi.advanceTimersByTime(3999)
    expect(useAppStore.getState().toasts).toHaveLength(1)

    vi.advanceTimersByTime(2)
    expect(useAppStore.getState().toasts).toHaveLength(0)
  })
})
