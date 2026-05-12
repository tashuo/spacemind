import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useT } from '@/lib/i18n'

// 输入框防抖的本地副本。
// 这里维护两层状态:本地 local 立刻反映按键(保持输入流畅),
// store 里的 searchQuery 延迟 200ms 才更新(避免每次按键都重建 FlexSearch 索引)。
// 200ms 是手感和性能的折中:更短会让长列表掉帧,更长会让用户察觉到延迟。
const DEBOUNCE_MS = 200

export function SearchBar() {
  const { t } = useT()
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const [local, setLocal] = useState(searchQuery)

  // 防抖写入 store。依赖 local 而非 searchQuery,避免外部清空时反向触发自己。
  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(local), DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [local, setSearchQuery])

  return (
    <div className="relative">
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="w-full px-4 py-2 pr-9 text-sm rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-purple-500 outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
      />
      {local && (
        <button
          onClick={() => setLocal('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs"
          aria-label={t('clearSearch')}
          title={t('clearSearch')}
        >
          ✕
        </button>
      )}
    </div>
  )
}
