import { describe, it, expect } from 'vitest'
import { reorderInList } from '@/lib/ui-utils'

describe('reorderInList', () => {
  it('moves a single item before target', () => {
    expect(reorderInList(['a', 'b', 'c', 'd'], ['c'], 'a', true)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('moves a single item after target', () => {
    expect(reorderInList(['a', 'b', 'c', 'd'], ['a'], 'c', false)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('preserves moving items relative order regardless of input order', () => {
    // moving ids 给的是 [d, b] 但 b 在 a 之前;算结果时应按 current 中的顺序 [b, d]
    expect(reorderInList(['a', 'b', 'c', 'd'], ['d', 'b'], 'a', true)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('dragging onto a member of moving set is a no-op (returns same reference)', () => {
    const current = ['a', 'b', 'c']
    expect(reorderInList(current, ['b'], 'b', true)).toBe(current)
  })

  it('returns original list when target is missing', () => {
    const current = ['a', 'b', 'c']
    expect(reorderInList(current, ['a'], 'z', true)).toBe(current)
  })

  it('multi-move spanning around target collapses correctly', () => {
    // 把 a + d 放到 b 之后:剩余 [b, c],insert at idx 1 → [b, a, d, c]
    expect(reorderInList(['a', 'b', 'c', 'd'], ['a', 'd'], 'b', false)).toEqual(['b', 'a', 'd', 'c'])
  })
})
