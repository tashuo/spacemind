import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Conversation, Platform, Space } from '@/lib/schema'
import { useT } from '@/lib/i18n'
import { colorForSpace, type SpacePalette } from '@/lib/ui-utils'
import { useAppStore } from '@/stores/app-store'
import { ChevronDown, ExternalLink, FileText, Star, StarFilled, Tag, Trash, X } from './icons'
import { ConversationTagEditor } from './conversation-tag-editor'
import { ConversationNoteDialog } from './conversation-note-dialog'

interface Props {
  conversation: Conversation
  palette: SpacePalette // 由父级根据所在空间决定;Unsorted 行也由父级传入(可降级到 indigo)
  selected: boolean
  /** 拖拽多选徽章用;parent 已经过滤,= 1 时不显示 */
  selectedCount: number
  /** 当前选区里的全部 id(任何卡片里的选中行都算)。
   *  拖拽当本行属于选区且选区 ≥ 2 时,payload 携带全部 id,以便批量移动。 */
  selectedIds: string[]
  /** 移动菜单候选(parent 已过滤掉当前所在空间) */
  availableSpaces: Space[]
  /** 同 space 内全部对话 id 的当前展示顺序,用来判断"拖到本行"算 reorder 还是 cross-space move */
  spaceConvIds?: string[]
  onClick: (modifiers: 'plain' | 'toggle' | 'range') => void
  /** 显式"在新标签页打开",同时也由 plain click 隐式触发 */
  onOpen: () => void
  /** null = 移到未分类 */
  onMove: (toSpaceId: string | null) => void
  onRemove: () => void
  /** 同 space 内拖拽排序的回调:把 movingIds 插到 targetConvId 的前/后。
   *  父级负责算最终顺序并调 store.reorderConversations。 */
  onReorder?: (movingIds: string[], targetConvId: string, before: boolean) => void
}

// 拖拽进行中的源对话 spaceId(null = unsorted)。dragover 阶段读取 dataTransfer.getData
// 会返回空,所以这里靠模块级变量同步通信。一次只能有一个 drag in progress,无并发问题。
let currentDragSourceSpaceId: string | null | undefined = undefined

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
  selectedIds,
  availableSpaces,
  spaceConvIds,
  onClick,
  onOpen,
  onMove,
  onRemove,
  onReorder,
}: Props) {
  const { t } = useT()
  const [moveOpen, setMoveOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const moveBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const tagBtnRef = useRef<HTMLButtonElement>(null)
  const [tagAnchor, setTagAnchor] = useState<DOMRect | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)

  // 同 space 拖拽排序的插入指示线位置;null = 当前 row 不是有效 reorder 目标
  const [dropEdge, setDropEdge] = useState<'top' | 'bottom' | null>(null)
  const rowSpaceId = conversation.spaceId ?? null
  const reorderEnabled = !!onReorder && !!spaceConvIds

  // 直接从 store 取 mutator;这些操作不需要父级介入(没有选区变化、没有路由),
  // 走 store 比往每个父级再灌一遍 callback 干净。allTags 用于 tag editor 的 autocomplete。
  const toggleStar = useAppStore((s) => s.toggleStar)
  const addTag = useAppStore((s) => s.addTag)
  const removeTag = useAppStore((s) => s.removeTag)
  const setConversationNote = useAppStore((s) => s.setConversationNote)
  const conversations = useAppStore((s) => s.conversations)

  // 全局已用 tag,大小写去重保留首次出现的写法。订阅 conversations 时性能不是问题:
  // 这里是 conversation-row,每行都会跑 —— 但 conversations 是同一引用,Set 也只算一次
  const allTags = useMemo(() => {
    const seen = new Map<string, string>()
    for (const c of conversations) {
      for (const tag of c.tags) {
        const key = tag.toLowerCase()
        if (!seen.has(key)) seen.set(key, tag)
      }
    }
    return Array.from(seen.values())
  }, [conversations])

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

  const starred = conversation.starred
  const hasNote = !!conversation.note?.trim()
  const tags = conversation.tags

  return (
    <div
      role="button"
      tabIndex={0}
      // 拖拽 payload:本行属于多选 + 选区 ≥ 2 → 携带全部选中 id;否则只本行。
      // 父级 SpaceCard / UnsortedCard 作为 drop target 收数组,调批量 move。
      draggable
      onDragStart={(e) => {
        const ids = selected && selectedIds.length > 1 ? selectedIds : [conversation.id]
        e.dataTransfer.setData(
          'application/x-spacemind-conv',
          JSON.stringify({ ids }),
        )
        e.dataTransfer.effectAllowed = 'move'
        // dragover 阶段读 dataTransfer 拿不到值,这里把源 spaceId 写到模块级变量,
        // 兄弟 row 在 dragover 时可同步判断是同 space 拖拽(= reorder)还是跨 space 移动
        currentDragSourceSpaceId = rowSpaceId
      }}
      onDragEnd={() => {
        currentDragSourceSpaceId = undefined
        setDropEdge(null)
      }}
      onDragOver={(e) => {
        if (!reorderEnabled) return
        // 只接同 space 的拖拽。currentDragSourceSpaceId === undefined 通常是从外部 OS 拖文件,
        // 也直接忽略 —— 避免误高亮
        if (currentDragSourceSpaceId === undefined) return
        if (currentDragSourceSpaceId !== rowSpaceId) return
        e.preventDefault()
        e.stopPropagation()
        // 鼠标在行内的相对 Y 值决定插入位置(上半 = 在本行前;下半 = 在本行后)
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const midY = rect.top + rect.height / 2
        setDropEdge(e.clientY < midY ? 'top' : 'bottom')
      }}
      onDragLeave={(e) => {
        // 用 relatedTarget 排除"鼠标只是进入了子节点"这种伪 leave
        const next = e.relatedTarget as Node | null
        if (next && e.currentTarget.contains(next)) return
        setDropEdge(null)
      }}
      onDrop={(e) => {
        if (!reorderEnabled || !onReorder || !spaceConvIds) {
          setDropEdge(null)
          return
        }
        if (currentDragSourceSpaceId !== rowSpaceId) {
          // 源不在本 space:不处理,让外层 SpaceCard / UnsortedCard 走 cross-space 路径
          setDropEdge(null)
          return
        }
        const edge = dropEdge
        setDropEdge(null)
        const raw = e.dataTransfer.getData('application/x-spacemind-conv')
        if (!raw) return
        try {
          const { ids } = JSON.parse(raw) as { ids: string[] }
          // 防御:任一 id 不在本 space → 转回 cross-space 语义(不要拦截)
          const inSpace = ids.filter((id) => spaceConvIds.includes(id))
          if (inSpace.length === 0 || inSpace.length !== ids.length) return
          // 拖到自己 = 无变化
          if (inSpace.length === 1 && inSpace[0] === conversation.id) return
          e.preventDefault()
          e.stopPropagation()
          onReorder(inSpace, conversation.id, edge !== 'bottom')
        } catch {
          // payload 不是预期格式 —— 不当 reorder 处理,让外层接管
        }
      }}
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
      className={`group/row relative flex items-start gap-2 pl-2 pr-2 py-1.5 -mx-2 rounded-md cursor-pointer transition-all duration-150 border-l-[3px] ${
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

      {/* 同 space reorder 的插入指示线 —— 顶部/底部各 2px,紫色高对比 */}
      {dropEdge === 'top' && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 -top-px h-0.5 rounded-full bg-purple-500"
        />
      )}
      {dropEdge === 'bottom' && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-purple-500"
        />
      )}

      {/* 左:星标 —— 常驻可见,off 状态淡灰,on 状态金黄,点击 toggle。
          不阻止冒泡? 阻止 —— 否则会触发行的 onClick 把对话打开 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          void toggleStar(conversation.id)
        }}
        title={t(starred ? 'unstarConversation' : 'starConversation')}
        aria-label={t(starred ? 'unstarConversation' : 'starConversation')}
        aria-pressed={starred}
        className={`flex-shrink-0 mt-[2px] w-5 h-5 flex items-center justify-center rounded transition-colors cursor-pointer ${
          starred
            ? 'text-amber-500 hover:text-amber-600'
            : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'
        }`}
      >
        {starred ? <StarFilled className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
      </button>

      {/* 左:平台标识(色块 + 缩写)*/}
      <span
        className={`flex-shrink-0 mt-[2px] text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${platformStyle.bg} ${platformStyle.text}`}
        aria-label={t(platform === 'chatgpt' ? 'platformChatgpt' : 'platformClaude')}
      >
        {platformAbbr}
      </span>

      {/* 中:标题 + 可选预览 + tag chips */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[13px] text-slate-800 dark:text-slate-200 transition-transform duration-150 group-hover/row:translate-x-0.5">
          <span className="truncate">{conversation.title || conversation.url}</span>
          {hasNote && (
            // 备注指示器 —— 标题旁的小信纸图标 + tooltip 显示完整 note,
            // 不占行高,也不抢标题的注意力
            <span
              title={conversation.note}
              className="flex-shrink-0 inline-flex items-center justify-center text-amber-500/70 dark:text-amber-400/70"
              aria-label={t('noteLabel')}
            >
              <FileText className="w-3 h-3" />
            </span>
          )}
        </span>
        {previewText && (
          <span className="text-[11px] italic text-slate-500 dark:text-slate-500 truncate">
            {previewText}
          </span>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="group/chip inline-flex items-center gap-0.5 pl-1.5 pr-0.5 py-px rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 text-[10px] font-medium"
              >
                {tag}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    void removeTag(conversation.id, tag)
                  }}
                  aria-label={t('removeTag', { name: tag })}
                  className="inline-flex items-center justify-center w-3 h-3 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800/60 opacity-0 group-hover/chip:opacity-100 transition-opacity cursor-pointer"
                >
                  <X className="w-2 h-2" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 右:hover 显示的按钮集群 */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          title={t('openInNewTab')}
          aria-label={t('openInNewTab')}
        >
          <ExternalLink className="w-3 h-3" />
        </button>
        <button
          ref={tagBtnRef}
          onClick={(e) => {
            e.stopPropagation()
            if (tagAnchor) setTagAnchor(null)
            else if (tagBtnRef.current) setTagAnchor(tagBtnRef.current.getBoundingClientRect())
          }}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          title={t('editTags')}
          aria-label={t('editTags')}
        >
          <Tag className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setNoteOpen(true)
          }}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
            hasNote
              ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          title={t('editConvNote')}
          aria-label={t('editConvNote')}
        >
          <FileText className="w-3 h-3" />
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
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
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
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
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
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
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
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 italic cursor-pointer"
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

      {tagAnchor && (
        <ConversationTagEditor
          anchor={tagAnchor}
          current={tags}
          allTags={allTags}
          onAdd={(tag) => void addTag(conversation.id, tag)}
          onRemove={(tag) => void removeTag(conversation.id, tag)}
          onClose={() => setTagAnchor(null)}
        />
      )}

      {noteOpen && (
        <ConversationNoteDialog
          title={conversation.title || conversation.url}
          initial={conversation.note}
          onSave={(note) => void setConversationNote(conversation.id, note)}
          onClose={() => setNoteOpen(false)}
        />
      )}
    </div>
  )
}
