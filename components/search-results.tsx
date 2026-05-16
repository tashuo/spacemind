import { useMemo } from 'react'
import type { Conversation, Space } from '@/lib/schema'
import { useT } from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { colorForSpace } from '@/lib/ui-utils'
import { createSearchIndex, type SearchHit } from '@/lib/search'
import { ConversationRow } from './conversation-row'

interface Props {
  query: string
  spaces: Space[]
  conversations: Conversation[]
}

// 用一个稳定的字符串签名做 useMemo 依赖,避免在每次 conversations 数组引用变化时
// 都重建索引。conversations.length + 各自 platformUpdatedAt 的合计足够区分增删改:
// 增/删会改长度;改字段会改 platformUpdatedAt(乐观更新已经写入 now)。
// messages 也带上 length —— 它一变就必然意味着导入/删除发生过,需要重建消息索引。
function indexSignature(conversations: Conversation[], messageCount: number): string {
  let sum = 0
  for (const c of conversations) {
    sum += c.platformUpdatedAt ?? c.capturedAt
  }
  return `${conversations.length}:${sum}:${messageCount}`
}

export function SearchResults({ query, spaces, conversations }: Props) {
  const { t } = useT()

  const selectedConvIds = useAppStore((s) => s.selectedConvIds)
  const moveConversationToSpace = useAppStore((s) => s.moveConversationToSpace)
  const removeConversations = useAppStore((s) => s.removeConversations)
  const selectConv = useAppStore((s) => s.selectConv)
  // 全文索引需要正文 —— store 在 load() 时一次性把 IDB 里的 messages 拉进来,
  // 这里直接读;首次没导入数据时是空数组,createSearchIndex 也能正常工作
  const messages = useAppStore((s) => s.messages)

  const signature = indexSignature(conversations, messages.length)
  const index = useMemo(
    () => createSearchIndex({ conversations, messages }),
    // signature 已经覆盖 conversations / messages 的增删改,直接列上 conversations / messages
    // 反而会让索引在每次乐观更新返回新引用时无谓重建;故有意只依赖 signature。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  )

  // 命中 → 按 spaceId 分组(null = unsorted)。
  // 注意保持 hits 内部顺序(已按 FlexSearch 相关性排序),分组时用 Map 的插入序。
  const grouped = useMemo(() => {
    const hits: SearchHit[] = index.query(query)
    const byId = new Map(conversations.map((c) => [c.id, c]))
    const groups = new Map<string, Conversation[]>() // key: spaceId 或 '__unsorted__'
    for (const h of hits) {
      const conv = byId.get(h.conversationId)
      if (!conv) continue
      const key = conv.spaceId ?? '__unsorted__'
      const arr = groups.get(key)
      if (arr) arr.push(conv)
      else groups.set(key, [conv])
    }
    return { hits, groups }
  }, [index, query, conversations])

  const totalHits = grouped.hits.length
  const totalGroups = grouped.groups.size

  // 拍平为可见顺序,供 range-click 用(在搜索结果里跨组 shift+click 也能选)
  const visibleConvIds = useMemo(() => {
    const ids: string[] = []
    for (const arr of grouped.groups.values()) {
      for (const c of arr) ids.push(c.id)
    }
    return ids
  }, [grouped])

  if (totalHits === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
        {t('noSearchResults')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {t('searchResultsSummary', { n: totalHits, s: totalGroups })}
      </div>

      {Array.from(grouped.groups.entries()).map(([key, convs]) => {
        const space = key === '__unsorted__' ? null : spaces.find((s) => s.id === key)
        const palette = colorForSpace(space ? space.id : '__unsorted__')
        const label = space ? space.name : t('unsorted')
        // 候选空间:把当前所在空间过滤掉(unsorted 时全部空间都可选)
        const availableSpaces = space ? spaces.filter((s) => s.id !== space.id) : spaces

        return (
          <div
            key={key}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40"
          >
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800">
              <span
                className={`w-1.5 h-1.5 rounded-full ${palette.dot}`}
                aria-hidden
              />
              {space?.emoji && <span className="text-sm">{space.emoji}</span>}
              <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 tracking-tight truncate">
                {label}
              </h3>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {convs.length}
              </span>
            </div>
            <div className="px-4 py-2 space-y-0.5">
              {convs.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  palette={palette}
                  selected={selectedConvIds.has(c.id)}
                  selectedCount={selectedConvIds.size}
                  selectedIds={Array.from(selectedConvIds)}
                  availableSpaces={availableSpaces}
                  onClick={(mode) =>
                    selectConv(c.id, mode === 'plain' ? 'replace' : mode, visibleConvIds)
                  }
                  onOpen={() => window.open(c.url, '_blank', 'noopener')}
                  onMove={(toSpaceId) => void moveConversationToSpace(c.id, toSpaceId)}
                  onRemove={() => void removeConversations([c.id])}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
