import { useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { ImportProgress } from './import-progress'

// 首次启动落地页:展示导出指引 + 拖拽区。导入成功后 conversations 非空,App.tsx 自然切走;
// 失败时 store 已弹 toast,组件保持挂载等用户重试
export function OnboardingDialog() {
  const importing = useAppStore((s) => s.importing)
  const importFromZip = useAppStore((s) => s.importFromZip)
  const createSpace = useAppStore((s) => s.createSpace)
  const [drag, setDrag] = useState(false)

  const handleFile = async (file: File) => {
    const buf = await file.arrayBuffer()
    try {
      await importFromZip(buf)
    } catch {
      // store 已 pushToast,这里吞掉避免 unhandled rejection
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center">
        <div className="text-5xl mb-4">🧠</div>
        <h1 className="text-2xl font-semibold">Welcome to SpaceMind</h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Organize your AI conversations into project spaces. Start by importing
          your existing chats — drop a ZIP export below.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <ProviderCard
          name="ChatGPT"
          steps={[
            'Open chatgpt.com → Settings',
            'Data controls → Export data',
            'Wait for the email, download the ZIP',
          ]}
        />
        <ProviderCard
          name="Claude"
          steps={[
            'Open claude.ai → Settings → Privacy',
            'Export data',
            'Download the ZIP when ready',
          ]}
        />
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          const file = e.dataTransfer.files?.[0]
          if (file) void handleFile(file)
        }}
        className={`mt-8 block w-full px-8 py-12 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center ${
          drag
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10'
        }`}
      >
        <input
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        <div className="text-3xl mb-3">📦</div>
        <div className="font-medium">Drop your export ZIP here</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          …or click to choose a file
        </div>
      </label>

      <div className="mt-6 text-center">
        <button
          onClick={() => void createSpace('My first space', 'violet')}
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
        >
          Skip and create a space manually
        </button>
      </div>

      {importing && <ImportProgress />}
    </div>
  )
}

function ProviderCard({ name, steps }: { name: string; steps: string[] }) {
  return (
    <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
      <div className="font-semibold text-slate-900 dark:text-slate-100">{name}</div>
      <ol className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400 list-decimal pl-4">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  )
}
