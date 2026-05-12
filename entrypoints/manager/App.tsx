import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/lib/theme'
import { useT } from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { OnboardingDialog } from '@/components/onboarding-dialog'
import { ImportProgress } from '@/components/import-progress'
import { SpaceList } from '@/components/space-list'
import { Plus } from '@/components/icons'

export default function App() {
  useTheme()
  const { t } = useT()
  const { loaded, spaces, conversations, importing, load, importFromZip, createSpace } = useAppStore()
  useEffect(() => {
    void load()
  }, [load])
  // Unsorted 默认展开:首次导入用户多半还没分类,展开能让对话立即可见
  const [unsortedExpanded, setUnsortedExpanded] = useState(true)

  if (!loaded) return null

  // 完全空状态(没空间也没会话)= 首次启动 / Replace 导入后的入口场景,直接走 onboarding
  const isEmpty = spaces.length === 0 && conversations.length === 0

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">SpaceMind</h1>
          {!isEmpty && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => void createSpace(t('newSpace'), 'violet')}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('newSpace')}
              </button>
              <ImportZipButton
                onPickFile={async (f) => {
                  try {
                    await importFromZip(await f.arrayBuffer())
                  } catch {
                    // toast already shown by store
                  }
                }}
              />
            </div>
          )}
        </header>

        {isEmpty ? (
          <OnboardingDialog />
        ) : (
          <SpaceList
            spaces={spaces}
            conversations={conversations}
            unsortedExpanded={unsortedExpanded}
            onToggleUnsorted={() => setUnsortedExpanded((v) => !v)}
          />
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
          if (e.target) e.target.value = '' // allow re-picking same file
        }}
      />
    </>
  )
}
