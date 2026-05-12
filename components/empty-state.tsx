import { useAppStore } from '@/stores/app-store'

export function EmptyState() {
  const createSpace = useAppStore((s) => s.createSpace)
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">🧠</div>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">No spaces yet</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Create a space to start organizing your AI conversations.
      </p>
      <button
        onClick={() => void createSpace('My first space', 'violet')}
        className="mt-6 px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 cursor-pointer transition-colors"
      >
        Create your first space
      </button>
    </div>
  )
}
