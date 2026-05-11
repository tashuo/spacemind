import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export const THEME_PREFS: ThemePref[] = ['system', 'light', 'dark']
const STORAGE_KEY = 'theme'

function detectSystemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

function applyDocumentTheme(pref: ThemePref): void {
  const dark = pref === 'dark' || (pref === 'system' && detectSystemDark())
  const root = document.documentElement
  if (dark) root.classList.add('dark')
  else root.classList.remove('dark')
}

export async function readThemePref(): Promise<ThemePref> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY)
    const v = stored[STORAGE_KEY]
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // fall through
  }
  return 'system'
}

export async function writeThemePref(pref: ThemePref): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: pref })
  } catch {
    // ignore
  }
}

export function useTheme(): {
  pref: ThemePref
  setPref: (p: ThemePref) => void
} {
  const [pref, setPrefState] = useState<ThemePref>('system')

  // 初始读取 + system 模式跟随系统变化 + 跨标签同步
  useEffect(() => {
    let mounted = true
    void readThemePref().then((p) => {
      if (mounted) {
        setPrefState(p)
        applyDocumentTheme(p)
      }
    })

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = () => {
      // 只有 system 模式才跟随
      if (pref === 'system') applyDocumentTheme('system')
    }
    mql.addEventListener('change', onSystemChange)

    const onStorageChange = (
      changes: { [k: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== 'local') return
      const change = changes[STORAGE_KEY]
      if (change && (change.newValue === 'light' || change.newValue === 'dark' || change.newValue === 'system')) {
        setPrefState(change.newValue)
        applyDocumentTheme(change.newValue)
      }
    }
    try {
      chrome.storage.onChanged.addListener(onStorageChange)
    } catch {
      // ignore
    }

    return () => {
      mounted = false
      mql.removeEventListener('change', onSystemChange)
      try {
        chrome.storage.onChanged.removeListener(onStorageChange)
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 当 pref 变化时,重新应用主题
  useEffect(() => {
    applyDocumentTheme(pref)
  }, [pref])

  const setPref = (p: ThemePref) => {
    setPrefState(p)
    void writeThemePref(p)
  }
  return { pref, setPref }
}
