import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@/lib/theme'
import { useT } from '@/lib/i18n'
import { useAppStore } from '@/stores/app-store'
import { OnboardingDialog } from '@/components/onboarding-dialog'
import { ImportProgress } from '@/components/import-progress'
import { SpaceList } from '@/components/space-list'
import { SearchBar } from '@/components/search-bar'
import { SearchResults } from '@/components/search-results'
import { ToastStack } from '@/components/toast-stack'
import { CommandPalette } from '@/components/command-palette'
import { HelpDialog } from '@/components/help-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import { LangToggle } from '@/components/lang-toggle'
import { Plus } from '@/components/icons'
import { THEME_PREFS } from '@/lib/theme'
import { LANGS, LANG_LABELS } from '@/lib/i18n'
import type { Command } from '@/lib/commands'
import { pickJsonFile } from '@/lib/export-import'

// 隐藏 ZIP 文件选择器的固定 id —— 命令面板里的 "Import ZIP" 命令通过这个
// id 直接 click() 它,这样不必把 file input 拆出来或开放 store 级别的引用。
const IMPORT_ZIP_PICKER_ID = '__import_zip_picker__'

export default function App() {
  // 主题钩子既负责把 document 的 dark class 应用上,
  // 也把当前 pref / setter 暴露给命令面板循环。一次调用,两件事。
  const { pref: themePref, setPref: setThemePref } = useTheme()
  const { t, lang, setLang } = useT()
  const { loaded, spaces, conversations, importing, load, importFromZip, createSpace, exportToJson, importFromJson } = useAppStore()
  const searchQuery = useAppStore((s) => s.searchQuery)

  useEffect(() => {
    void load()
  }, [load])

  // overlay / content script / 另一个扩展页可能在我们不知情时改 IDB ——
  // tab 回前台时再 load 一次,保证 manager 看到最新状态。
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  // background 在 sidebar 静默抓取后会广播 conversations:scraped。
  // 收到时立刻 reload + 弹 toast,这样 manager 开着时也能感知到「东西在自动进来」。
  const pushToast = useAppStore((s) => s.pushToast)
  useEffect(() => {
    const onMsg = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return
      const m = raw as { kind?: string; platform?: string; added?: number; updated?: number }
      if (m.kind !== 'conversations:scraped') return
      const added = m.added ?? 0
      if (added > 0) {
        const platform = m.platform === 'chatgpt' ? 'ChatGPT' : 'Claude'
        pushToast('info', t('toastCaptured', { n: added, platform }))
      }
      void load()
    }
    chrome.runtime.onMessage.addListener(onMsg)
    return () => chrome.runtime.onMessage.removeListener(onMsg)
  }, [load, pushToast, t])

  // Unsorted 默认展开:首次导入用户多半还没分类,展开能让对话立即可见
  const [unsortedExpanded, setUnsortedExpanded] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)

  // 全局 ⌘K / Ctrl+K —— 拦在 document 层面,任何聚焦状态都能开。
  // 注意:如果焦点在 contenteditable 或 input,我们仍然要拦 —— 这是命令面板的惯例
  // (用户不希望 ⌘K 被某个 textarea 吃掉)。所以不做 ignore-input 的判断。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // 命令列表:每次 spaces / themePref / 语言变化时重算。
  // Task 8 会在这里追加 Export JSON / Import JSON / Help 等命令。
  const commands: Command[] = useMemo(() => {
    const list: Command[] = []

    // —— Actions ——
    list.push({
      id: 'toggle-theme',
      group: 'action',
      label: t('cmdToggleTheme'),
      description:
        themePref === 'system'
          ? t('themeSystem')
          : themePref === 'light'
            ? t('themeLight')
            : t('themeDark'),
      perform: () => {
        const i = THEME_PREFS.indexOf(themePref)
        setThemePref(THEME_PREFS[(i + 1) % THEME_PREFS.length]!)
      },
    })

    // 切换语言 —— description 直接显示下一个语言的本地化名,用户一眼能预判按下后变成什么
    list.push({
      id: 'switch-language',
      group: 'action',
      label: t('cmdSwitchLanguage'),
      description: LANG_LABELS[LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]!],
      perform: () => {
        const i = LANGS.indexOf(lang)
        setLang(LANGS[(i + 1) % LANGS.length]!)
      },
    })

    list.push({
      id: 'import-zip',
      group: 'action',
      label: t('cmdImportZip'),
      perform: () => {
        // 复用 header 里隐藏的 file input —— 用 DOM id 触发其原生 click,
        // 避免再造一份 picker 状态;命令面板在选择后会立刻关闭,流程一致。
        document.getElementById(IMPORT_ZIP_PICKER_ID)?.click()
      },
    })

    list.push({
      id: 'export-json',
      group: 'action',
      label: t('cmdExportJson'),
      perform: () => {
        void exportToJson()
      },
    })

    list.push({
      id: 'import-json',
      group: 'action',
      label: t('cmdImportJson'),
      perform: () => {
        // pickJsonFile 必须在命令 perform 的同步链上调用 —— 浏览器才会把它
        // 视为用户激活,否则 file input click 会被静默拒。
        void (async () => {
          const file = await pickJsonFile()
          if (!file) return
          try {
            await importFromJson(file)
          } catch {
            // toast already pushed by store
          }
        })()
      },
    })

    list.push({
      id: 'help',
      group: 'action',
      label: t('cmdOpenHelp'),
      perform: () => setHelpDialogOpen(true),
    })

    // —— Spaces ——
    for (const s of spaces) {
      list.push({
        id: `show-${s.id}`,
        group: 'space',
        label: t('cmdShowSpace', { name: s.name }),
        perform: () => {
          document
            .getElementById(`space-${s.id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
      })
    }

    return list
  }, [themePref, setThemePref, lang, setLang, spaces, t, exportToJson, importFromJson])

  if (!loaded) return null

  // 完全空状态(没空间也没会话)= 首次启动 / Replace 导入后的入口场景,直接走 onboarding
  const isEmpty = spaces.length === 0 && conversations.length === 0
  // 仅当 trim 后非空才算搜索态 —— 用户敲空格不该把空间列表替换成空结果页
  const isSearching = searchQuery.trim().length > 0

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">SpaceMind</h1>
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            {!isEmpty && (
              <>
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
              </>
            )}
          </div>
        </header>

        {!isEmpty && (
          <div className="mb-4">
            <SearchBar />
          </div>
        )}

        {isEmpty ? (
          <OnboardingDialog />
        ) : isSearching ? (
          <SearchResults
            query={searchQuery}
            spaces={spaces}
            conversations={conversations}
          />
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
      <ToastStack />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />
      {helpDialogOpen && <HelpDialog onClose={() => setHelpDialogOpen(false)} />}
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
        id={IMPORT_ZIP_PICKER_ID}
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
