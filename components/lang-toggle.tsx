import { LANGS, LANG_LABELS, useT, type Lang } from '@/lib/i18n'
import { Globe } from './icons'

// 与 ThemeToggle 同构:单按钮 cycle 当前语言。
// 题面用 LANG_LABELS 取本地化标签(英文显示 "English",中文显示 "简体中文")
export function LangToggle() {
  const { t, lang, setLang } = useT()

  const next = (cur: Lang): Lang => {
    const i = LANGS.indexOf(cur)
    return LANGS[(i + 1) % LANGS.length]!
  }

  return (
    <button
      onClick={() => setLang(next(lang))}
      className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      title={`${t('language')}: ${LANG_LABELS[lang]}`}
      aria-label={`${t('language')}: ${LANG_LABELS[lang]}`}
    >
      <Globe className="w-4 h-4" />
    </button>
  )
}
