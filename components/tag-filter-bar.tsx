import { useAppStore } from '@/stores/app-store'
import { useT } from '@/lib/i18n'
import { X } from './icons'

// 显示当前激活的 tag 过滤器(AND 语义)。没有激活时整段不渲染,
// 让搜索框和空间列表之间不会出现多余空隙。
export function TagFilterBar() {
  const { t } = useT()
  const activeTagFilter = useAppStore((s) => s.activeTagFilter)
  const toggleTagFilter = useAppStore((s) => s.toggleTagFilter)
  const clearTagFilter = useAppStore((s) => s.clearTagFilter)
  const conversations = useAppStore((s) => s.conversations)

  if (activeTagFilter.size === 0) return null

  // store 内只存 lower-case key,显示时要取原始大小写 —— 从任一对话的 tags 里反查首次出现的写法。
  // 找不到说明 tag 已经被全部清掉了(filter 残留),按 lower-case 兜底显示
  const labelFor = (lowerKey: string): string => {
    for (const c of conversations) {
      for (const tag of c.tags) {
        if (tag.toLowerCase() === lowerKey) return tag
      }
    }
    return lowerKey
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50/60 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-purple-700 dark:text-purple-200">
        {t('filteringBy')}
      </span>
      {Array.from(activeTagFilter).map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-purple-200 dark:bg-purple-800/60 text-purple-800 dark:text-purple-100 text-[11px] font-medium"
        >
          {labelFor(key)}
          <button
            onClick={() => toggleTagFilter(key)}
            aria-label={t('removeTagFilter', { name: labelFor(key) })}
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-purple-300 dark:hover:bg-purple-700 cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <button
        onClick={clearTagFilter}
        className="ml-auto text-[11px] text-purple-700 dark:text-purple-200 hover:text-purple-900 dark:hover:text-white cursor-pointer transition-colors"
      >
        {t('clearFilter')}
      </button>
    </div>
  )
}
