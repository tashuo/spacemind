// 全屏遮罩 + 旋转 spinner —— 导入期间阻止误操作,统一交互预期
export function ImportProgress() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl px-6 py-4 shadow-xl flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Importing…</span>
      </div>
    </div>
  )
}
