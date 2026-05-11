import { useTheme } from '@/lib/theme'

export default function App() {
  useTheme()
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <h1 className="text-2xl font-semibold">SpaceMind</h1>
    </main>
  )
}
