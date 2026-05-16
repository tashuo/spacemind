import { useAppStore } from '@/stores/app-store'

// 全局浮层 —— store 维护 toasts + 自动消失,这里只负责渲染
// 不接受 props:直接从 store 取,避免 App 层为了透传重新渲染
export function ToastStack() {
  const toasts = useAppStore((s) => s.toasts)
  const dismissToast = useAppStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 min-w-[260px] max-w-[400px] pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismissToast(t.id)}
          role="status"
          className={`toast-in pointer-events-auto flex items-center gap-3 px-3.5 py-2.5 text-xs rounded-lg shadow-lg border cursor-pointer ${
            t.kind === 'error'
              ? 'bg-red-600 text-white border-red-700/30'
              : 'bg-slate-900 text-white border-slate-800'
          }`}
        >
          <span className="flex-1 text-left">{t.text}</span>
          {t.action && (
            // 行动按钮(如 Undo)—— 点击后调用方负责副作用,我们顺手 dismiss 当前 toast
            // 阻止冒泡:外层 onClick 也会 dismiss,但顺序上 action 必须先跑
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                t.action!.onAction()
                dismissToast(t.id)
              }}
              className="font-semibold underline text-white hover:text-white/90 cursor-pointer px-1"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              // 显式 × 按钮:阻止冒泡到外层 onClick 是为了避免 React 顺序触发(行为本就一致,但显式更清晰)
              e.stopPropagation()
              dismissToast(t.id)
            }}
            aria-label="Dismiss notification"
            className="text-white/70 hover:text-white text-base leading-none px-1 -my-0.5 cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
