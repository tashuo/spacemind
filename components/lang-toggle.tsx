import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LANGS, LANG_LABELS, useT, type Lang } from '@/lib/i18n'
import { Globe, ChevronDown, Check } from './icons'

// 自定义语言下拉。不用原生 <select>(受 OS 样式控制、与应用设计语言不统一),
// 复用 conversation-row "Move to" 菜单同一套视觉:portal 面板 + 点外/Esc/滚动关闭。
export function LangToggle() {
  const { t, lang, setLang } = useT()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScrollOrResize = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={openMenu}
        className="inline-flex items-center gap-1 h-8 pl-2 pr-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title={`${t('language')}: ${LANG_LABELS[lang]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('language')}: ${LANG_LABELS[lang]}`}
      >
        <Globe className="w-4 h-4" />
        <span className="text-xs font-medium">{LANG_LABELS[lang]}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="fixed min-w-[9rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden py-1"
            style={{ top: pos.top, right: pos.right }}
          >
            {LANGS.map((l) => {
              const selected = l === lang
              return (
                <button
                  key={l}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setLang(l)
                    setOpen(false)
                  }}
                  className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    selected
                      ? 'text-purple-600 dark:text-purple-400 font-medium'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Check
                    className={`w-3.5 h-3.5 flex-shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <span className="truncate">{LANG_LABELS[l]}</span>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
