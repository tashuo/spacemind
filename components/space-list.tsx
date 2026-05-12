import { useMemo } from 'react'
import type { Conversation, Space } from '@/lib/schema'
import { useT } from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { colorForSpace } from '@/lib/ui-utils'
import { SpaceCard } from './space-card'
import { ConversationRow } from './conversation-row'
import { ChevronDown } from './icons'

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
  const removeConversations = useAppStore((s) => s.removeConversations)
  const selectConv = useAppStore((s) => s.selectConv)

  // 复用 indigo 调色板作为 unsorted 的视觉锚 —— 它在 6 色环里中性偏冷,不会和任一真实空间撞色
  const palette = useMemo(() => colorForSpace('__unsorted__'), [])
  const visibleConvIds = useMemo(() => conversations.map((c) => c.id), [conversations])

  return (
    <div className="relative bg-slate-50/40 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
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

        {expanded && (
          <div className="mt-2">
            {conversations.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                {t('cardNoConversationsUnsorted')}
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
