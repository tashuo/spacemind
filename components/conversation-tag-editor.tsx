import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/i18n'
import { X } from './icons'

interface Props {
  /** anchor button rect 用于定位弹层 */
  anchor: DOMRect
  current: string[]
  /** 全局已用过的 tag(供 autocomplete);大小写敏感保留原样,这里按 lower 去重 */
  allTags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  onClose: () => void
}

// ConversationRow 上 hover 出现的"标签" hover 按钮触发的小弹层。
// 主流程:输入 + 回车 / 点 chip 选 → onAdd;chip 上 × → onRemove;Esc 或点外关闭。
// 不持有 conversation 引用,纯受控 —— 父级负责把变化 propagate 给 store。
export function ConversationTagEditor({ anchor, current, allTags, onAdd, onRemove, onClose }: Props) {
  const { t } = useT()
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // 挂载即聚焦输入框,弹层一出来就可以直接打字
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 点外关闭。注意:click 的目标如果是 anchor 按钮自己,我们让按钮的 onClick 决定
  // (那个 handler 会 toggle 关闭),不要在这里再关一遍,否则会被立刻重新打开
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (popRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // 候选 tag:全局 - 当前已加;按输入做前缀过滤(忽略大小写)
  const suggestions = useMemo(() => {
    const currentLower = new Set(current.map((s) => s.toLowerCase()))
    const inputLower = input.trim().toLowerCase()
    return allTags
      .filter((tag) => !currentLower.has(tag.toLowerCase()))
      .filter((tag) => inputLower === '' || tag.toLowerCase().includes(inputLower))
      .slice(0, 8)
  }, [allTags, current, input])

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setInput('')
    inputRef.current?.focus()
  }

  return createPortal(
    <div
      ref={popRef}
      className="fixed w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden"
      // anchor 在右侧 hover 按钮区,我们让弹层右侧对齐 anchor 右沿,向下展开
      style={{ top: anchor.bottom + 4, right: window.innerWidth - anchor.right }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 已加标签 */}
      {current.length > 0 && (
        <div className="px-2 pt-2 pb-1 flex flex-wrap gap-1 border-b border-slate-100 dark:border-slate-800">
          {current.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 text-[11px] font-medium"
            >
              {tag}
              <button
                onClick={() => onRemove(tag)}
                aria-label={t('removeTag', { name: tag })}
                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800/60 cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(input)
          }
        }}
        placeholder={t('addTagPlaceholder')}
        className="w-full px-3 py-2 text-xs bg-transparent outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
      />

      {/* 候选(autocomplete)*/}
      {suggestions.length > 0 && (
        <>
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
            {t('suggestionsLabel')}
          </div>
          <ul className="max-h-40 overflow-y-auto py-0.5">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  onClick={() => commit(s)}
                  className="w-full text-left px-3 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>,
    document.body,
  )
}
