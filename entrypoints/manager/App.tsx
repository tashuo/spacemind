import { useEffect, useRef } from 'react'
import { useTheme } from '@/lib/theme'
import { useAppStore } from '@/stores/app-store'
import { EmptyState } from '@/components/empty-state'
import { OnboardingDialog } from '@/components/onboarding-dialog'
import { ImportProgress } from '@/components/import-progress'

export default function App() {
  useTheme()
  const { loaded, spaces, conversations, importing, load, importFromZip } = useAppStore()
  useEffect(() => {
    void load()
  }, [load])

  if (!loaded) return null

  // 完全空状态(没空间也没会话)= 首次启动 / Replace 导入后的入口场景,直接走 onboarding
  const isEmpty = spaces.length === 0 && conversations.length === 0
  const spaceById = new Map(spaces.map((s) => [s.id, s]))

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">SpaceMind</h1>
          {!isEmpty && (
            <ImportZipButton onPickFile={async (f) => {
              try {
                await importFromZip(await f.arrayBuffer())
              } catch {
                // toast already shown by store
              }
            }} />
          )}
        </header>

        {isEmpty ? (
          <OnboardingDialog />
        ) : (
          <>
            <SectionHeading className="mt-8">Spaces</SectionHeading>
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
            {conversations.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No conversations yet. Click <strong>Import ZIP</strong> above to load your ChatGPT or Claude export.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {conversations.slice(0, 20).map((c) => {
                  const sp = c.spaceId ? spaceById.get(c.spaceId) : undefined
                  return (
                    <li
                      key={c.id}
                      className="px-3 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                    >
                      <span className="inline-block w-14 text-xs text-slate-500">{c.platform}</span>
                      {c.title}
                      {sp && (
                        <span className="ml-2 text-xs text-slate-500">(in: {sp.emoji} {sp.name})</span>
                      )}
                    </li>
                  )
                })}
                {conversations.length > 20 && (
                  <li className="text-xs text-slate-500 px-3">
                    …and {conversations.length - 20} more
                  </li>
                )}
              </ul>
            )}
          </>
        )}

        {importing && <ImportProgress />}
      </div>
    </main>
  )
}

function ImportZipButton({ onPickFile }: { onPickFile: (file: File) => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        className="px-3 py-1.5 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 cursor-pointer transition-colors"
      >
        Import ZIP
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onPickFile(f)
          if (e.target) e.target.value = ''  // allow re-picking same file
        }}
      />
    </>
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
