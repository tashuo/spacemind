import { useEffect } from 'react'
import { useTheme } from '@/lib/theme'
import { useAppStore } from '@/stores/app-store'
import { EmptyState } from '@/components/empty-state'
import { OnboardingDialog } from '@/components/onboarding-dialog'
import { ImportProgress } from '@/components/import-progress'

export default function App() {
  useTheme()
  const { loaded, spaces, conversations, importing, load } = useAppStore()
  useEffect(() => {
    void load()
  }, [load])

  if (!loaded) return null

  // 完全空状态(没空间也没会话)= 首次启动 / Replace 导入后的入口场景,直接走 onboarding
  const isEmpty = spaces.length === 0 && conversations.length === 0

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold">SpaceMind</h1>

        {isEmpty ? (
          <OnboardingDialog />
        ) : (
          <>
            <SectionHeading>Spaces</SectionHeading>
            {spaces.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="mt-2 space-y-2">
                {spaces.map((s) => (
                  <li
                    key={s.id}
                    className="px-3 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  >
                    {s.emoji} {s.name}
                  </li>
                ))}
              </ul>
            )}
            <SectionHeading className="mt-8">
              Conversations ({conversations.length})
            </SectionHeading>
            <ul className="mt-2 space-y-1">
              {conversations.slice(0, 20).map((c) => (
                <li
                  key={c.id}
                  className="px-3 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  <span className="inline-block w-14 text-xs text-slate-500">{c.platform}</span>
                  {c.title}
                </li>
              ))}
              {conversations.length > 20 && (
                <li className="text-xs text-slate-500 px-3">
                  …and {conversations.length - 20} more
                </li>
              )}
            </ul>
          </>
        )}

        {importing && <ImportProgress />}
      </div>
    </main>
  )
}

function SectionHeading({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2
      className={`text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${className}`}
    >
      {children}
    </h2>
  )
}
