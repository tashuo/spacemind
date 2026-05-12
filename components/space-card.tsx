import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Conversation, Space } from '@/lib/schema'
import { useT } from '@/lib/i18n'
import { colorForSpace, relativeTime } from '@/lib/ui-utils'
import { useAppStore } from '@/stores/app-store'
import { ConversationRow } from './conversation-row'
import { ChevronDown, Copy, FileText, Pencil, Sparkle, Star, StarFilled, Trash } from './icons'

interface Props {
  space: Space
  conversations: Conversation[]
  otherSpaces: Space[]
}

// 单条对话拖拽的 MIME。命名空间到 spacemind 避免和别的扩展冲撞。
// 注:Phase 4 只做单条拖拽;批量拖拽(多选 + 一起拖)推迟到 Phase 4b。
const CONV_MIME = 'application/x-spacemind-conv'

export function SpaceCard({ space, conversations, otherSpaces }: Props) {
  const { t } = useT()
  const palette = colorForSpace(space.id)

  const selectedConvIds = useAppStore((s) => s.selectedConvIds)
  const renameSpace = useAppStore((s) => s.renameSpace)
  const removeSpace = useAppStore((s) => s.removeSpace)
  const setEmoji = useAppStore((s) => s.setEmoji)
  const setNote = useAppStore((s) => s.setNote)
  const togglePin = useAppStore((s) => s.togglePin)
  const createSpace = useAppStore((s) => s.createSpace)
  const moveConversationToSpace = useAppStore((s) => s.moveConversationToSpace)
  const moveConversationsToSpace = useAppStore((s) => s.moveConversationsToSpace)
  const removeConversations = useAppStore((s) => s.removeConversations)
  const selectConv = useAppStore((s) => s.selectConv)
  const clearSelection = useAppStore((s) => s.clearSelection)

  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(space.name)
  const [dragOver, setDragOver] = useState(false)
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [bulkMenuPos, setBulkMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const bulkMoveBtnRef = useRef<HTMLButtonElement>(null)
  const bulkMenuRef = useRef<HTMLDivElement>(null)

  // 该卡片内被选中的对话 id(按当前显示顺序)。
  // 注:多选状态由 store 全局保管,这里只做与本卡片的交集 —— 不同卡片可同时高亮选区
  const visibleConvIds = useMemo(() => conversations.map((c) => c.id), [conversations])
  const cardSelectedIds = useMemo(
    () => visibleConvIds.filter((id) => selectedConvIds.has(id)),
    [visibleConvIds, selectedConvIds],
  )
  const cardSelectionCount = cardSelectedIds.length

  // 关闭"移动到…"菜单的常规策略:点外 / 滚动 / 缩放
  useEffect(() => {
    if (!bulkMoveOpen) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (bulkMoveBtnRef.current?.contains(target)) return
      if (bulkMenuRef.current?.contains(target)) return
      setBulkMoveOpen(false)
    }
    const onScrollOrResize = () => setBulkMoveOpen(false)
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [bulkMoveOpen])

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed.length === 0) {
      setDraft(space.name)
      setEditing(false)
      return
    }
    if (trimmed !== space.name) void renameSpace(space.id, trimmed)
    setEditing(false)
  }

  const onConfirmDelete = () => {
    const ok = window.confirm(t('confirmDeleteSpace', { name: space.name, n: conversations.length }))
    if (ok) void removeSpace(space.id)
  }

  const onEditEmoji = () => {
    const next = window.prompt(t('editEmoji'), space.emoji ?? '')
    if (next === null) return
    void setEmoji(space.id, next === '' ? undefined : next)
  }

  const onEditNote = () => {
    const next = window.prompt(t('editNote'), space.note ?? '')
    if (next === null) return
    void setNote(space.id, next === '' ? undefined : next)
  }

  const onDuplicate = async () => {
    // 复制只复 Space 本身的元数据;对话不跟着克隆 —— 一条对话本就属于唯一空间。
    // 名字加 "(copy)" 兼顾英文/中文用户的可读性
    const id = await createSpace(`${space.name} (copy)`, space.color)
    if (space.emoji) await setEmoji(id, space.emoji)
    if (space.note) await setNote(id, space.note)
  }

  // 批量操作 —— Open all / Move to / Remove / Cancel
  // 每次打开标签都 setTimeout 50ms 让出主线程,避免被浏览器的 pop-up 阻拦器一次性吞掉
  const openAllSelected = () => {
    const ids = new Set(cardSelectedIds)
    const ordered = conversations.filter((c) => ids.has(c.id))
    ordered.forEach((c, i) => {
      setTimeout(() => window.open(c.url, '_blank', 'noopener'), i * 50)
    })
    clearSelection()
  }

  const openBulkMoveMenu = () => {
    if (!bulkMoveBtnRef.current) return
    const rect = bulkMoveBtnRef.current.getBoundingClientRect()
    setBulkMenuPos({ top: rect.bottom + 4, left: rect.left })
    setBulkMoveOpen(true)
  }

  const handleBulkMove = (toId: string | null) => {
    if (cardSelectedIds.length === 0) return
    void moveConversationsToSpace(cardSelectedIds, toId)
    setBulkMoveOpen(false)
    clearSelection()
  }

  const handleBulkRemove = () => {
    if (cardSelectedIds.length === 0) return
    const ok = window.confirm(t('confirmRemoveConversations', { n: cardSelectedIds.length }))
    if (!ok) return
    void removeConversations(cardSelectedIds)
  }

  // 拖放:卡片接收来自其它卡片(或 unsorted)的单条对话拖拽。
  // Phase 4b 会在这里扩展为多条 + 卡片重排;当前只处理 single conv 移动。
  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(CONV_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!dragOver) setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // 只有真正离开卡片才清状态(避免冒泡误清)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(CONV_MIME)
    setDragOver(false)
    if (!raw) return
    e.preventDefault()
    try {
      const { id } = JSON.parse(raw) as { id: string }
      // 当前空间内拖到自己 = no-op,静默忽略
      if (visibleConvIds.includes(id)) return
      void moveConversationToSpace(id, space.id)
    } catch {
      // payload 损坏,放弃
    }
  }

  return (
    <div
      className={`group/card relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600 ${
        dragOver ? 'ring-2 ring-purple-400 bg-purple-50/40 dark:bg-purple-900/10' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 左侧色条:与 space-tab 风格一致,装饰用,不拦事件 */}
      <div className={`absolute left-0 top-4 bottom-4 w-[5px] rounded-r-full ${palette.bar} pointer-events-none`} />

      <div className={`pl-4 pr-4 py-4 rounded-xl transition-colors duration-200 ${palette.headerHoverGradient}`}>
        {/* 头部:折叠按钮 + emoji/dot + 名称 + 计数徽章 + 时间 + 备注 + 右侧动作 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCollapsed((v) => !v)}
                className="w-5 h-5 -ml-1 flex items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                title={collapsed ? t('expand') : t('collapse')}
                aria-label={collapsed ? t('expand') : t('collapse')}
                aria-expanded={!collapsed}
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
                />
              </button>
              {space.emoji ? (
                <span
                  className="text-base leading-none flex-shrink-0 transition-transform duration-200 group-hover/card:scale-110"
                  aria-hidden
                >
                  {space.emoji}
                </span>
              ) : (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${palette.dot} flex-shrink-0 transition-transform duration-200 group-hover/card:scale-150`}
                />
              )}
              {editing ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') {
                      setDraft(space.name)
                      setEditing(false)
                    }
                  }}
                  className="flex-1 px-1.5 py-0.5 -ml-1.5 -my-0.5 text-[15px] font-semibold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              ) : (
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                  {space.name}
                </h3>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-mono text-[11px] ring-1 transition-all duration-150 ${palette.countBg} ${palette.countText} ${palette.countRing} ${palette.countRingHover} group-hover/card:font-semibold`}
              >
                {conversations.length}
              </span>
              <span>{t('conversationsLabel')}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>{relativeTime(space.updatedAt, t)}</span>
            </div>
            {space.note && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
                {space.note}
              </p>
            )}
          </div>
          {/* 右侧:hover 才显的动作组 */}
          <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
            <button
              onClick={() => {
                setDraft(space.name)
                setEditing(true)
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={t('rename')}
              aria-label={t('rename')}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onEditEmoji}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                space.emoji
                  ? 'hover:bg-slate-100 dark:hover:bg-slate-700 text-base'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title={t('editEmoji')}
              aria-label={t('editEmoji')}
            >
              {space.emoji ? <span aria-hidden>{space.emoji}</span> : <Sparkle className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onEditNote}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                space.note
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title={t('editNote')}
              aria-label={t('editNote')}
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" aria-hidden />
            <button
              onClick={() => void togglePin(space.id)}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150 ${
                space.pinned
                  ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)] hover:scale-110'
                  : 'text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title={space.pinned ? t('unpinSpace') : t('pinSpace')}
              aria-label={space.pinned ? t('unpinSpace') : t('pinSpace')}
            >
              {space.pinned ? <StarFilled className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => void onDuplicate()}
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={t('duplicate')}
              aria-label={t('duplicate')}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onConfirmDelete}
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title={t('delete')}
              aria-label={t('delete')}
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 多选批量操作栏:本卡片有选中项时才显示;不同卡片各显示自己的交集 */}
        {!collapsed && cardSelectionCount > 0 && (
          <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-semibold">
              {cardSelectionCount}
            </span>
            <span className="text-xs font-medium text-purple-800 dark:text-purple-200">
              {t('selectionCount', { n: cardSelectionCount })}
            </span>
            <span className="flex-1" />
            <button
              onClick={openAllSelected}
              className="px-2 h-6 text-xs font-medium rounded text-purple-800 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-800/40 transition-colors"
            >
              {t('openSelected')}
            </button>
            <button
              ref={bulkMoveBtnRef}
              onClick={() => (bulkMoveOpen ? setBulkMoveOpen(false) : openBulkMoveMenu())}
              className="px-2 h-6 text-xs font-medium rounded text-purple-800 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-800/40 transition-colors"
            >
              {t('moveTo')}
            </button>
            <button
              onClick={handleBulkRemove}
              className="px-2 h-6 text-xs font-medium rounded text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              {t('removeSelected')}
            </button>
            <button
              onClick={clearSelection}
              className="px-2 h-6 text-xs font-medium rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('clearSelection')}
            </button>
          </div>
        )}

        {/* 批量"移到…"菜单(Portal 出来,避免被卡片 overflow 截断) */}
        {bulkMoveOpen &&
          createPortal(
            <div
              ref={bulkMenuRef}
              className="fixed w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden"
              style={{ top: bulkMenuPos.top, left: bulkMenuPos.left }}
            >
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                {t('moveTo')}
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {otherSpaces.map((s) => {
                  const sPalette = colorForSpace(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleBulkMove(s.id)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <span className={`flex-shrink-0 w-2 h-2 rounded-full ${sPalette.dot}`} aria-hidden />
                      {s.emoji && <span className="flex-shrink-0">{s.emoji}</span>}
                      <span className="truncate">{s.name}</span>
                    </button>
                  )
                })}
                {otherSpaces.length > 0 && (
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                )}
                <button
                  onClick={() => handleBulkMove(null)}
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
            document.body,
          )}

        {/* 对话列表 / 空态 / 拖放提示 */}
        {!collapsed && (
          <div className="mt-3">
            {conversations.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                {dragOver ? t('dropConversationHere') : t('cardNoConversations')}
              </div>
            ) : (
              <div className="space-y-0.5">
                {conversations.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    palette={palette}
                    selected={selectedConvIds.has(c.id)}
                    selectedCount={selectedConvIds.size}
                    availableSpaces={otherSpaces}
                    onClick={(mode) => selectConv(c.id, mode === 'plain' ? 'replace' : mode, visibleConvIds)}
                    onOpen={() => window.open(c.url, '_blank', 'noopener')}
                    onMove={(toSpaceId) => void moveConversationToSpace(c.id, toSpaceId)}
                    onRemove={() => void removeConversations([c.id])}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
