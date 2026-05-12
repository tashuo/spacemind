import { THEME_PREFS, useTheme, type ThemePref } from '@/lib/theme'
import { useT } from '@/lib/i18n'
import { Monitor, Moon, Sun } from './icons'

// 一颗按钮在 system → light → dark → system 之间循环切换。
// 没做"三段拨杆"是因为多数标签管理类扩展用单击 cycle,符合用户习惯。
// 想要直接跳到指定模式可以走命令面板("Toggle theme" 同样会 cycle,够用)。
export function ThemeToggle() {
  const { t } = useT()
  const { pref, setPref } = useTheme()

  const nextPref = (cur: ThemePref): ThemePref => {
    const i = THEME_PREFS.indexOf(cur)
    return THEME_PREFS[(i + 1) % THEME_PREFS.length]!
  }

  const labelFor = (p: ThemePref): string =>
    p === 'system' ? t('themeSystem') : p === 'light' ? t('themeLight') : t('themeDark')

  const Icon = pref === 'system' ? Monitor : pref === 'light' ? Sun : Moon

  return (
    <button
      onClick={() => setPref(nextPref(pref))}
      className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      title={`${t('theme')}: ${labelFor(pref)}`}
      aria-label={`${t('theme')}: ${labelFor(pref)}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
