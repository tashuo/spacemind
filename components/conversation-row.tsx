import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Conversation, Platform, Space } from '@/lib/schema'
import { useT } from '@/lib/i18n'
import { colorForSpace, type SpacePalette } from '@/lib/ui-utils'
import { ChevronDown, ExternalLink, Trash } from './icons'

interface Props {
  conversation: Conversation
  palette: SpacePalette // 由父级根据所在空间决定;Unsorted 行也由父级传入(可降级到 indigo)
  selected: boolean
  /** 拖拽多选徽章用;parent 已经过滤,= 1 时不显示 */
  selectedCount: number
  /** 移动菜单候选(parent 已过滤掉当前所在空间) */
  availableSpaces: Space[]
  onClick: (modifiers: 'plain' | 'toggle' | 'range') => void
  /** 显式"在新标签页打开",同时也由 plain click 隐式触发 */
  onOpen: () => void
  /** null = 移到未分类 */
  onMove: (toSpaceId: string | null) => void
  onRemove: () => void
}

// 平台 → 3 字母缩写。固定大写,monospace 风格;不需要 i18n,这是品牌标识不是文案。
const PLATFORM_ABBR: Record<Platform, string> = {
  chatgpt: 'CGT',
  claude: 'CLD',
}

// 平台 → 颜色 token(Tailwind class)。
// 注:这里独立于 Space palette —— 平台标识应该跨空间稳定,不随空间色变化。
const PLATFORM_STYLE: Record<Platform, { bg: string; text: string }> = {
  chatgpt: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  claude: {
    bg: 'bg-orange-50 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
  },
}

// 预览文本截断阈值。80 是经验值:窄列表也能塞下一行,够嗅探主题但不喧宾夺主。
const PREVIEW_MAX = 80

export function ConversationRow({
  conversation,
  palette,
  selected,
  selectedCount,
  availableSpaces,
  onClick,
  onOpen,
  onMove,
  onRemove,
}: Props) {
  const { t } = useT()
  const [moveOpen, setMoveOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const moveBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 弹出菜单的关闭策略:点外 / 滚动 / 缩放 / Esc。和 spacetab 的 space-tab-row 同一套。
  useEffect(() => {
    if (!moveOpen) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (moveBtnRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setMoveOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoveOpen(false)
    }
    const onScrollOrResize = () => setMoveOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [moveOpen])

  const openMenu = () => {
    if (!moveBtnRef.current) return
    const rect = moveBtnRef.current.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    })
    setMoveOpen(true)
  }

  const platform = conversation.platform
  const platformStyle = PLATFORM_STYLE[platform]
  const platformAbbr = PLATFORM_ABBR[platform]

  const preview = conversation.preview?.firstUserMessage?.trim() ?? ''
  const previewText =
    preview.length > PREVIEW_MAX ? `${preview.slice(0, PREVIEW_MAX - 1)}…` : preview

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          onClick('toggle')
          return
        }
        if (e.shiftKey) {
          e.preventDefault()
          onClick('range')
          return
        }
        // 普通点击:同时选中 + 打开;让用户单次操作就能达成最常见目标。
        onClick('plain')
        onOpen()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onClick('plain')
          onOpen()
        }
      }}
      className={`group/row relative flex items-start gap-2.5 pl-2.5 pr-2 py-1.5 -mx-2 rounded-md cursor-pointer transition-all duration-150 border-l-[3px] ${
        selected
          ? 'bg-purple-50/60 dark:bg-purple-900/20 border-purple-500 ring-1 ring-purple-400/60 dark:ring-purple-600/60'
          : `border-transparent ${palette.rowHoverBg} ${palette.rowAccent}`
      }`}
      title={conversation.url}
    >
      {selected && selectedCount > 1 && (
        // 多选时左侧悬浮 "+N" 徽章 —— 让用户清楚多选规模,后续拖拽 UI 也复用同一视觉
        <span
          className="absolute -left-2 top-1 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-bold leading-none shadow"
          aria-hidden
        >
          +{selectedCount - 1}
        </span>
      )}

      {/* 左:平台标识(色块 + 缩写)*/}
      <span
        className={`flex-shrink-0 mt-[2px] text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${platformStyle.bg} ${platformStyle.text}`}
        aria-label={t(platform === 'chatgpt' ? 'platformChatgpt' : 'platformClaude')}
      >
        {platformAbbr}
      </span>

      {/* 中:标题 + 可选预览 */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[13px] text-slate-800 dark:text-slate-200 truncate transition-transform duration-150 group-hover/row:translate-x-0.5">
          {conversation.title || conversation.url}
        </span>
        {previewText && (
          <span className="text-[11px] italic text-slate-500 dark:text-slate-500 truncate">
            {previewText}
          </span>
        )}
      </div>

      {/* 右:hover 显示的三枚按钮 */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={t('openInNewTab')}
          aria-label={t('openInNewTab')}
        >
          <ExternalLink className="w-3 h-3" />
        </button>
        {/* 即便候选空间为空,我们仍渲染按钮 —— 此时菜单只显示 "Unsorted",
            让用户能把已分类对话直接打回未分类 */}
        <button
          ref={moveBtnRef}
          onClick={(e) => {
            e.stopPropagation()
            if (moveOpen) setMoveOpen(false)
            else openMenu()
          }}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={t('moveToSpace')}
          aria-label={t('moveToSpace')}
        >
          <ChevronDown className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          title={t('removeConversation')}
          aria-label={t('removeConversation')}
        >
          <Trash className="w-3 h-3" />
        </button>
      </div>

      {moveOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden"
            style={{ top: menuPos.top, right: menuPos.right }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              {t('moveTo')}
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {availableSpaces.map((s) => {
                const sPalette = colorForSpace(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onMove(s.id)
                      setMoveOpen(false)
                    }}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <span
                      className={`flex-shrink-0 w-2 h-2 rounded-full ${sPalette.dot}`}
                      aria-hidden
                    />
                    {s.emoji && <span className="flex-shrink-0">{s.emoji}</span>}
                    <span className="truncate">{s.name}</span>
                  </button>
                )
              })}
              {availableSpaces.length > 0 && (
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onMove(null)
                  setMoveOpen(false)
                }}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 italic"
              >
                <span
                  className="flex-shrink-0 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"
                  aria-hidden
                />
                <span className="truncate">{t('moveToUnsorted')}</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
