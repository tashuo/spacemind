import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/i18n'
import { Sparkle, X } from './icons'

interface Props {
  onClose: () => void
}

// SpaceMind 帮助/欢迎对话框 —— 用 Portal 挂到 body,避开父容器 overflow / z-index 影响。
// 内容按 SpaceMind 的数据模型(conversation / space / unsorted)重写,不再有 SpaceTab 的 vault / 切换概念。
export function HelpDialog({ onClose }: Props) {
  const { t } = useT()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] max-h-[85vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Sparkle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('welcomeTitle')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">SpaceMind</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          <p>{t('helpIntro')}</p>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('helpQuickStartHeading')}
            </h3>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>{t('helpQuickStart1')}</li>
              <li>{t('helpQuickStart2')}</li>
              <li>{t('helpQuickStart3')}</li>
              <li>{t('helpQuickStart4')}</li>
              <li>{t('helpQuickStart5')}</li>
            </ol>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('helpConceptsHeading')}
            </h3>
            <dl className="space-y-2.5">
              <div>
                <dt className="font-medium text-slate-900 dark:text-slate-100">
                  {t('helpConceptSpaceTerm')}
                </dt>
                <dd className="text-slate-600 dark:text-slate-300 mt-0.5">
                  {t('helpConceptSpaceDesc')}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900 dark:text-slate-100">
                  {t('helpConceptConversationTerm')}
                </dt>
                <dd className="text-slate-600 dark:text-slate-300 mt-0.5">
                  {t('helpConceptConversationDesc')}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900 dark:text-slate-100">
                  {t('helpConceptUnsortedTerm')}
                </dt>
                <dd className="text-slate-600 dark:text-slate-300 mt-0.5">
                  {t('helpConceptUnsortedDesc')}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('helpShortcutsHeading')}
            </h3>
            <ul className="space-y-1.5 list-disc pl-5 text-slate-600 dark:text-slate-300">
              <li>{t('helpKbdPalette')}</li>
              <li>{t('helpKbdOverlay')}</li>
              <li>{t('helpKbdToggleSelect')}</li>
              <li>{t('helpKbdRangeSelect')}</li>
              <li>{t('helpKbdEscape')}</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('helpPrivacyHeading')}
            </h3>
            <p className="text-slate-600 dark:text-slate-300">{t('helpPrivacy')}</p>
          </section>
        </div>

        <footer className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end bg-slate-50 dark:bg-slate-800/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            {t('confirm')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
