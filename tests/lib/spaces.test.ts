import { describe, it, expect } from 'vitest'
import {
  createSpace,
  renameSpace,
  deleteSpaceFromList,
  setPinned,
  setEmoji,
  setNote,
  setSortIndex,
  sortedForDisplay,
} from '@/lib/spaces'
import type { Space } from '@/lib/schema'

// 工厂函数:生成符合 schema 的最小 Space,只覆盖测试关心的字段
const makeSpace = (overrides: Partial<Space> = {}): Space => ({
  id: 'sp1',
  name: 'Work',
  color: 'indigo',
  createdAt: 100,
  updatedAt: 100,
  ...overrides,
})

describe('createSpace', () => {
  it('returns a Space with given id, name and color', () => {
    const space = createSpace(
      { id: 'sp1', name: 'Work', color: 'indigo' },
      1000,
    )
    expect(space.id).toBe('sp1')
    expect(space.name).toBe('Work')
    expect(space.color).toBe('indigo')
  })

  it('sets createdAt and updatedAt to now', () => {
    const space = createSpace(
      { id: 'sp1', name: 'Work', color: 'indigo' },
      1234,
    )
    expect(space.createdAt).toBe(1234)
    expect(space.updatedAt).toBe(1234)
  })

  it('omits emoji and note when not provided', () => {
    const space = createSpace(
      { id: 'sp1', name: 'Work', color: 'indigo' },
      1000,
    )
    expect(space.emoji).toBeUndefined()
    expect(space.note).toBeUndefined()
  })

  it('passes through emoji and note when provided', () => {
    const space = createSpace(
      {
        id: 'sp1',
        name: 'Work',
        color: 'violet',
        emoji: '🧠',
        note: 'AI safety notes',
      },
      1000,
    )
    expect(space.emoji).toBe('🧠')
    expect(space.note).toBe('AI safety notes')
  })
})

describe('renameSpace', () => {
  it('changes name', () => {
    const sp = makeSpace({ name: 'Old' })
    const next = renameSpace(sp, 'New', 200)
    expect(next.name).toBe('New')
  })

  it('updates updatedAt', () => {
    const sp = makeSpace({ updatedAt: 100 })
    const next = renameSpace(sp, 'X', 999)
    expect(next.updatedAt).toBe(999)
  })

  it('does not mutate the input (different reference, original unchanged)', () => {
    const sp = makeSpace({ name: 'Old', updatedAt: 100 })
    const next = renameSpace(sp, 'New', 200)
    expect(next).not.toBe(sp)
    expect(sp.name).toBe('Old')
    expect(sp.updatedAt).toBe(100)
  })
})

describe('deleteSpaceFromList', () => {
  it('removes matching space', () => {
    const list = [
      makeSpace({ id: 'a' }),
      makeSpace({ id: 'b' }),
      makeSpace({ id: 'c' }),
    ]
    const next = deleteSpaceFromList(list, 'b')
    expect(next.map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('returns same array reference when id not found', () => {
    const list = [makeSpace({ id: 'a' })]
    const next = deleteSpaceFromList(list, 'ghost')
    expect(next).toBe(list)
  })

  it('removes only one space when called with that id', () => {
    const list = [
      makeSpace({ id: 'a' }),
      makeSpace({ id: 'b' }),
    ]
    const next = deleteSpaceFromList(list, 'a')
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe('b')
  })
})

describe('setPinned', () => {
  it('sets pinned true', () => {
    const sp = makeSpace({ pinned: undefined })
    const next = setPinned(sp, true, 300)
    expect(next.pinned).toBe(true)
  })

  it('unpins (sets pinned false → field removed)', () => {
    const sp = makeSpace({ pinned: true })
    const next = setPinned(sp, false, 300)
    expect(next.pinned).toBeUndefined()
  })

  it('updates updatedAt', () => {
    const sp = makeSpace({ updatedAt: 100 })
    const next = setPinned(sp, true, 555)
    expect(next.updatedAt).toBe(555)
  })

  it('does not mutate input', () => {
    const sp = makeSpace({ pinned: undefined, updatedAt: 100 })
    const next = setPinned(sp, true, 300)
    expect(next).not.toBe(sp)
    expect(sp.pinned).toBeUndefined()
    expect(sp.updatedAt).toBe(100)
  })
})

describe('setEmoji', () => {
  it('sets emoji when given a non-empty value', () => {
    const sp = makeSpace()
    const next = setEmoji(sp, '📚', 300)
    expect(next.emoji).toBe('📚')
    expect(next.updatedAt).toBe(300)
  })

  it('clears emoji when given undefined', () => {
    const sp = makeSpace({ emoji: '📚' })
    const next = setEmoji(sp, undefined, 300)
    expect(next.emoji).toBeUndefined()
  })

  it('clears emoji when given empty string', () => {
    const sp = makeSpace({ emoji: '📚' })
    const next = setEmoji(sp, '', 300)
    expect(next.emoji).toBeUndefined()
  })
})

describe('setNote', () => {
  it('sets note when given a non-empty value', () => {
    const sp = makeSpace()
    const next = setNote(sp, 'remember me', 300)
    expect(next.note).toBe('remember me')
    expect(next.updatedAt).toBe(300)
  })

  it('clears note when given undefined', () => {
    const sp = makeSpace({ note: 'old' })
    const next = setNote(sp, undefined, 300)
    expect(next.note).toBeUndefined()
  })

  it('clears note when given empty string', () => {
    const sp = makeSpace({ note: 'old' })
    const next = setNote(sp, '', 300)
    expect(next.note).toBeUndefined()
  })
})

describe('setSortIndex', () => {
  it('sets sortIndex', () => {
    const sp = makeSpace()
    const next = setSortIndex(sp, 5, 300)
    expect(next.sortIndex).toBe(5)
  })

  it('updates updatedAt', () => {
    const sp = makeSpace({ updatedAt: 100 })
    const next = setSortIndex(sp, 0, 777)
    expect(next.updatedAt).toBe(777)
  })

  it('does not mutate input', () => {
    const sp = makeSpace({ sortIndex: 1, updatedAt: 100 })
    const next = setSortIndex(sp, 9, 300)
    expect(next).not.toBe(sp)
    expect(sp.sortIndex).toBe(1)
    expect(sp.updatedAt).toBe(100)
  })
})

describe('sortedForDisplay', () => {
  it('places pinned spaces first regardless of updatedAt', () => {
    const a = makeSpace({ id: 'a', pinned: false, updatedAt: 999 })
    const b = makeSpace({ id: 'b', pinned: true, updatedAt: 100 })
    expect(sortedForDisplay([a, b]).map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('within pinned: sortIndex ascending (0, 1, 2)', () => {
    const a = makeSpace({ id: 'a', pinned: true, sortIndex: 2 })
    const b = makeSpace({ id: 'b', pinned: true, sortIndex: 0 })
    const c = makeSpace({ id: 'c', pinned: true, sortIndex: 1 })
    expect(sortedForDisplay([a, b, c]).map((s) => s.id)).toEqual(['b', 'c', 'a'])
  })

  it('within same pinned status and both sortIndex undefined: updatedAt descending', () => {
    const a = makeSpace({ id: 'a', updatedAt: 100 })
    const b = makeSpace({ id: 'b', updatedAt: 300 })
    const c = makeSpace({ id: 'c', updatedAt: 200 })
    expect(sortedForDisplay([a, b, c]).map((s) => s.id)).toEqual(['b', 'c', 'a'])
  })

  it('within same pinned status and same sortIndex: updatedAt descending', () => {
    const a = makeSpace({ id: 'a', sortIndex: 0, updatedAt: 100 })
    const b = makeSpace({ id: 'b', sortIndex: 0, updatedAt: 200 })
    expect(sortedForDisplay([a, b]).map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('treats undefined sortIndex as +Infinity (sortIndex defined wins)', () => {
    const a = makeSpace({ id: 'a' })
    const b = makeSpace({ id: 'b', sortIndex: 5 })
    expect(sortedForDisplay([a, b]).map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('mixed case: pinned with sortIndex first, then unpinned with sortIndex, then unpinned by updatedAt', () => {
    const spaces = [
      makeSpace({ id: 'p1', pinned: true, sortIndex: 1 }),
      makeSpace({ id: 'p0', pinned: true, sortIndex: 0 }),
      makeSpace({ id: 'u_idx', sortIndex: 0, updatedAt: 50 }),
      makeSpace({ id: 'u_late', updatedAt: 300 }),
      makeSpace({ id: 'u_early', updatedAt: 100 }),
    ]
    expect(sortedForDisplay(spaces).map((s) => s.id)).toEqual([
      'p0',
      'p1',
      'u_idx',
      'u_late',
      'u_early',
    ])
  })

  it('returns a new array (does not mutate input)', () => {
    const list = [makeSpace({ id: 'a' }), makeSpace({ id: 'b' })]
    const next = sortedForDisplay(list)
    expect(next).not.toBe(list)
  })
})
