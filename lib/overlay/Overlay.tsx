import { useEffect, useState } from 'react'
import { sendRuntimeMessage } from '@/lib/runtime-messages'
import type { Platform, Space } from '@/lib/schema'

// Overlay 是 Cmd+Shift+J 触发的弹层。它不持久任何状态,关闭即重置 ——
// 这样跨会话(content script 被 SPA 重启)行为可预测,不需要做 storage 缓存。
export function Overlay() {
  const [open, setOpen] = useState(false)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  // 保存成功后短暂显示「✓ Saved to X」,再关闭 —— 没这个反馈用户会以为没反应
  const [savedTo, setSavedTo] = useState<string | null>(null)

  // background 通过 chrome.tabs.sendMessage 推 `overlay:toggle`,这是 content-script-internal
  // 消息,不进 RuntimeMessageSchema —— 所以这里手动 narrow,不用 sendRuntimeMessage 的解析路径
  useEffect(() => {
    const onMsg = (msg: unknown) => {
      if (
        msg &&
        typeof msg === 'object' &&
        (msg as { kind?: string }).kind === 'overlay:toggle'
      ) {
        setOpen((v) => !v)
        setQuery('')
      }
    }
    chrome.runtime.onMessage.addListener(onMsg)
    return () => chrome.runtime.onMessage.removeListener(onMsg)
  }, [])

  // Esc 关闭 —— 注意监听器挂在 document 上,shadow DOM 的 keydown 会冒泡到 document(默认 composed)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // 打开时才拉 spaces 列表,而不是 mount 时一次性 ——
  // overlay 在用户从不触发的情况下不会发任何 IPC,降低空转噪声
  useEffect(() => {
    if (!open) return
    void sendRuntimeMessage({ kind: 'spaces:list-request' }).then((reply) => {
      if (reply?.kind === 'spaces:list-reply') setSpaces(reply.spaces)
    })
  }, [open])

  // 关闭状态下展示右下角浮动按钮(FAB),提高入口可发现性。
  // 用户即使不知道 Cmd+Shift+K 也能一眼看到这个按钮。
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="SpaceMind — save current conversation (⌘⇧K)"
        aria-label="Open SpaceMind"
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105 transition-all duration-150 flex items-center justify-center cursor-pointer ring-1 ring-white/10"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>
    )
  }

  const platform = detectPlatform(location.href)
  // content script 只会注入 chatgpt.com / claude.ai,正常不会走到 null;
  // 但万一 matches 配错或 host_permissions 漂了,直接 noop 比崩溃好
  if (!platform) return null
  const conv = currentConversation(platform)

  const filtered = spaces.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const save = async (spaceId: string) => {
    if (!conv) return
    setBusy(true)
    const reply = await sendRuntimeMessage({
      kind: 'conversation:save-current',
      platform,
      conversation: conv,
      spaceId,
    })
    setBusy(false)
    if (reply?.kind === 'conversation:save-reply' && !reply.ok) {
      // 失败:console 打日志,关掉浮层
      console.error('[SpaceMind] save failed:', reply.error)
      setOpen(false)
      return
    }
    // 成功:展示 1.2 秒确认页,再自动关闭
    const sp = spaces.find((s) => s.id === spaceId)
    setSavedTo(sp?.name ?? 'space')
    setTimeout(() => {
      setSavedTo(null)
      setOpen(false)
      setQuery('')
    }, 1200)
  }

  return (
    <div
      // 点 backdrop 关闭,内层 stopPropagation 阻止冒泡
      onClick={() => setOpen(false)}
      className="fixed inset-0 flex items-start justify-center pt-32 bg-slate-900/40 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        {savedTo ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-emerald-600 dark:text-emerald-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="text-sm text-slate-800 dark:text-slate-200">
              Saved to <strong>{savedTo}</strong>
            </div>
          </div>
        ) : (
        <>
        <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            Save to space
          </div>
          {conv && (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
              {conv.title}
            </div>
          )}
        </div>
        <input
          autoFocus
          disabled={busy}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type to filter…"
          className="w-full px-4 py-2 text-sm bg-transparent outline-none border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200"
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-xs text-slate-500">
              {spaces.length === 0
                ? 'No spaces yet — open the manager to create one.'
                : 'No spaces match.'}
            </li>
          ) : (
            filtered.map((s) => (
              <li key={s.id}>
                <button
                  disabled={busy}
                  onClick={() => void save(s.id)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                >
                  {s.emoji ? <span className="mr-2">{s.emoji}</span> : null}
                  {s.name}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="px-4 py-2 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          ↵ Save · Esc Close · ⌘⇧K Toggle
        </div>
        </>
        )}
      </div>
    </div>
  )
}

// content script 的 matches 已经把 host 收敛到这两家,这里只是双保险
function detectPlatform(href: string): Platform | null {
  if (href.includes('chatgpt.com')) return 'chatgpt'
  if (href.includes('claude.ai')) return 'claude'
  return null
}

// 从 URL 上提取当前会话的 id,SPA 路由切换后 location.pathname 会同步更新
function currentConversation(
  platform: Platform,
): { id: string; url: string; title: string } | null {
  if (platform === 'chatgpt') {
    const m = /\/c\/([\w-]+)/.exec(location.pathname)
    if (!m || !m[1]) return null
    return { id: m[1], url: location.href, title: document.title }
  }
  const m = /\/chat\/([\w-]+)/.exec(location.pathname)
  if (!m || !m[1]) return null
  return { id: m[1], url: location.href, title: document.title }
}
