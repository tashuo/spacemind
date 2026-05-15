import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Conversation, Space } from '@/lib/schema'
import { useT } from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { colorForSpace } from '@/lib/ui-utils'
import { SpaceCard } from './space-card'
import { ConversationRow } from './conversation-row'
import { ChevronDown } from './icons'

const CONV_MIME = 'application/x-spacemind-conv'

interface SpaceListProps {
  spaces: Space[]
  conversations: Conversation[]
  unsortedExpanded: boolean
  onToggleUnsorted: () => void
}

export function SpaceList({
  spaces,
  conversations,
  unsortedExpanded,
  onToggleUnsorted,
}: SpaceListProps) {
  // 按 spaceId 分组一次,避免每张卡片单独 filter 一次产生 O(n*m) 复杂度
  const bySpace = useMemo(() => {
    const m = new Map<string, Conversation[]>()
    for (const c of conversations) {
      if (!c.spaceId) continue
      const arr = m.get(c.spaceId)
      if (arr) arr.push(c)
      else m.set(c.spaceId, [c])
    }
    return m
  }, [conversations])

  const unsorted = useMemo(() => conversations.filter((c) => !c.spaceId), [conversations])

  return (
    <div className="space-y-3">
      {spaces.map((s) => (
        <SpaceCard
          key={s.id}
          space={s}
          conversations={bySpace.get(s.id) ?? []}
          otherSpaces={spaces.filter((x) => x.id !== s.id)}
        />
      ))}
      {/* Unsorted 是一个虚拟分组,不是 Space —— 没有改名/置顶/删除等动作,
          只允许对里面的对话做"Move to"或拖出去。当 unsorted 为空时仍渲染一个折叠头,
          这样首次导入但还没分类的用户更容易看到这个入口。 */}
      <UnsortedCard
        conversations={unsorted}
        expanded={unsortedExpanded}
        onToggle={onToggleUnsorted}
        otherSpaces={spaces}
      />
    </div>
  )
}

interface UnsortedCardProps {
  conversations: Conversation[]
  expanded: boolean
  onToggle: () => void
  otherSpaces: Space[]
}

function UnsortedCard({ conversations, expanded, onToggle, otherSpaces }: UnsortedCardProps) {
  const { t } = useT()
  const selectedConvIds = useAppStore((s) => s.selectedConvIds)
  const moveConversationToSpace = useAppStore((s) => s.moveConversationToSpace)
  const moveConversationsToSpace = useAppStore((s) => s.moveConversationsToSpace)
  const removeConversations = useAppStore((s) => s.removeConversations)
  const selectConv = useAppStore((s) => s.selectConv)
  const clearSelection = useAppStore((s) => s.clearSelection)

  // 复用 indigo 调色板作为 unsorted 的视觉锚 —— 它在 6 色环里中性偏冷,不会和任一真实空间撞色
  const palette = useMemo(() => colorForSpace('__unsorted__'), [])
  const visibleConvIds = useMemo(() => conversations.map((c) => c.id), [conversations])
  const selectedIdsArr = useMemo(() => Array.from(selectedConvIds), [selectedConvIds])
  const cardSelectedIds = useMemo(
    () => visibleConvIds.filter((id) => selectedConvIds.has(id)),
    [visibleConvIds, selectedConvIds],
  )

  const [dragOver, setDragOver] = useState(false)
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [bulkMenuPos, setBulkMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const bulkMoveBtnRef = useRef<HTMLButtonElement>(null)
  const bulkMenuRef = useRef<HTMLDivElement>(null)

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

  const openBulkMoveMenu = () => {
    if (!bulkMoveBtnRef.current) return
    const rect = bulkMoveBtnRef.current.getBoundingClientRect()
    setBulkMenuPos({ top: rect.bottom + 4, left: rect.left })
    setBulkMoveOpen(true)
  }

  const openAllSelected = () => {
    const ids = new Set(cardSelectedIds)
    const ordered = conversations.filter((c) => ids.has(c.id))
    ordered.forEach((c, i) => {
      setTimeout(() => window.open(c.url, '_blank', 'noopener'), i * 50)
    })
    clearSelection()
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

  // Drop target:接收来自空间卡的拖拽,放入 Unsorted = spaceId = null
  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(CONV_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!dragOver) setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
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
      const { ids } = JSON.parse(raw) as { ids: string[] }
      if (!Array.isArray(ids) || ids.length === 0) return
      // 已经在 Unsorted 的就不重复 move
      const incoming = ids.filter((id) => !visibleConvIds.includes(id))
      if (incoming.length === 0) return
      if (incoming.length === 1) {
        void moveConversationToSpace(incoming[0]!, null)
      } else {
        void moveConversationsToSpace(incoming, null)
      }
      clearSelection()
    } catch {
      // payload 损坏
    }
  }

  const cardSelectionCount = cardSelectedIds.length

  return (
    <div
      className={`relative bg-slate-50/40 dark:bg-slate-900/40 rounded-xl border border-dashed transition-all duration-150 ${
        dragOver ? 'border-purple-400 bg-purple-50/40 dark:bg-purple-900/10' : 'border-slate-300 dark:border-slate-700'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="pl-4 pr-4 py-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 w-full text-left"
          aria-expanded={expanded}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 text-slate-500 dark:text-slate-400 ${expanded ? '' : '-rotate-90'}`}
          />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 flex-shrink-0" aria-hidden />
          <h3 className="text-[14px] font-semibold text-slate-700 dark:text-slate-300 tracking-tight">
            {t('unsorted')}
          </h3>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono text-[11px] ring-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ring-slate-200/60 dark:ring-slate-700/40">
            {conversations.length}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 italic ml-1 truncate">
            {t('unsortedSubtitle')}
          </span>
        </button>

        {/* 选区栏:Unsorted 里也支持批量动作 */}
        {expanded && cardSelectionCount > 0 && (
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

        {/* 批量「移到…」菜单(Portal,避免被卡片裁剪) */}
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
                {otherSpaces.length === 0 && (
                  <div className="px-2 py-3 text-xs text-slate-400 dark:text-slate-500 italic text-center">
                    {t('noOtherSpaces') /* fallback: 「No other spaces yet」 */}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )}

        {expanded && (
          <div className="mt-2">
            {conversations.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                {dragOver ? t('dropConversationHere') : t('cardNoConversationsUnsorted')}
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
                    selectedIds={selectedIdsArr}
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
