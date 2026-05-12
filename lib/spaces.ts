import type { PaletteKey, Space } from './schema'

// 纯函数:对 Space / Space[] 做不可变变换
// 不依赖 chrome.*、IndexedDB、任何 IO;所有"现在时间"由调用方传入,便于测试

export interface CreateSpaceInit {
  id: string
  name: string
  color: PaletteKey
  emoji?: string
  note?: string
}

/** 构造一个全新的 Space 对象;不负责持久化 */
export function createSpace(init: CreateSpaceInit, now: number): Space {
  const space: Space = {
    id: init.id,
    name: init.name,
    color: init.color,
    createdAt: now,
    updatedAt: now,
  }
  if (init.emoji !== undefined && init.emoji !== '') space.emoji = init.emoji
  if (init.note !== undefined && init.note !== '') space.note = init.note
  return space
}

/** 返回一个新的 Space:仅更新 name 与 updatedAt,输入不被改动 */
export function renameSpace(space: Space, name: string, now: number): Space {
  return { ...space, name, updatedAt: now }
}

/**
 * 从列表中过滤掉指定 id 的 Space。
 * 找不到时返回原数组引用,便于上层判断"是否需要落库"。
 */
export function deleteSpaceFromList(spaces: Space[], id: string): Space[] {
  const idx = spaces.findIndex((s) => s.id === id)
  if (idx === -1) return spaces
  return spaces.filter((s) => s.id !== id)
}

/**
 * 切换 pinned。pinned=false 时移除字段而不是写 false,
 * 与 schema 的 optional 保持一致,避免存储里出现 "pinned: false" 噪声。
 */
export function setPinned(space: Space, pinned: boolean, now: number): Space {
  const next: Space = { ...space, updatedAt: now }
  if (pinned) {
    next.pinned = true
  } else {
    delete next.pinned
  }
  return next
}

/**
 * 设置 emoji;undefined 或空字符串表示清除。
 * 不做 trim:emoji 可能包含 ZWJ 等不可见连接符,贸然 trim 会破坏组合表情。
 */
export function setEmoji(space: Space, emoji: string | undefined, now: number): Space {
  const next: Space = { ...space, updatedAt: now }
  if (emoji === undefined || emoji === '') {
    delete next.emoji
  } else {
    next.emoji = emoji
  }
  return next
}

/** 设置 note;undefined 或空字符串表示清除 */
export function setNote(space: Space, note: string | undefined, now: number): Space {
  const next: Space = { ...space, updatedAt: now }
  if (note === undefined || note === '') {
    delete next.note
  } else {
    next.note = note
  }
  return next
}

/** 设置 sortIndex,并刷新 updatedAt */
export function setSortIndex(space: Space, sortIndex: number, now: number): Space {
  return { ...space, sortIndex, updatedAt: now }
}

/**
 * 显示顺序:
 *   1. pinned 在前
 *   2. 同 pinned 状态下,sortIndex 升序(undefined 视作 +Infinity,排到最后)
 *   3. 再按 updatedAt 降序兜底
 * 返回新数组,不修改输入。
 */
export function sortedForDisplay(spaces: Space[]): Space[] {
  return [...spaces].sort((a, b) => {
    const aPin = a.pinned ? 1 : 0
    const bPin = b.pinned ? 1 : 0
    if (aPin !== bPin) return bPin - aPin
    const aIdx = a.sortIndex ?? Number.POSITIVE_INFINITY
    const bIdx = b.sortIndex ?? Number.POSITIVE_INFINITY
    if (aIdx !== bIdx) return aIdx - bIdx
    return b.updatedAt - a.updatedAt
  })
}
