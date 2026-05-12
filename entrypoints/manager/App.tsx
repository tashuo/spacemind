import { useEffect } from 'react'
import { useTheme } from '@/lib/theme'
import { useAppStore } from '@/stores/app-store'
import { EmptyState } from '@/components/empty-state'

export default function App() {
  useTheme()
  const { loaded, spaces, load } = useAppStore()
  useEffect(() => { void load() }, [load])

  if (!loaded) return null

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold">SpaceMind</h1>
        {spaces.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-6 space-y-2">
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
      </div>
    </main>
  )
}
