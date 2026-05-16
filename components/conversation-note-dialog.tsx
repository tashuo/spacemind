import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/i18n'

interface Props {
  title: string
  initial: string | undefined
  onSave: (note: string | undefined) => void
  onClose: () => void
}

// 单字段编辑器:打开时聚焦 textarea,Esc 取消,Cmd/Ctrl+Enter 保存。
// 用 modal 而不是 inline 编辑,因为 ConversationRow 已经塞满了 ——
// note 内容可能 1~2 行,inline 输入会让行高跳动很难看。
export function ConversationNoteDialog({ title, initial, onSave, onClose }: Props) {
  const { t } = useT()
  const [value, setValue] = useState(initial ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        save()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const save = () => {
    const trimmed = value.trim()
    onSave(trimmed === '' ? undefined : trimmed)
    onClose()
  }

  const clear = () => {
    onSave(undefined)
    onClose()
  }

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-slate-900/40 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            {t('noteLabel')}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate" title={title}>
            {title}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('convNotePlaceholder')}
          rows={4}
          className="w-full px-4 py-3 text-sm bg-transparent outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 resize-none"
        />
        <div className="px-4 py-2 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={clear}
            disabled={!initial}
            className="px-2.5 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {t('clearNote')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={save}
              className="px-3 py-1 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 cursor-pointer transition-colors"
            >
              {t('saveNote')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
