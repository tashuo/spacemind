# SpaceMind Phase 3 — Content Scripts (Sidebar Scrape + ⌘ Overlay)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject content scripts into chatgpt.com and claude.ai that (a) silently scrape the sidebar conversation list and auto-append new conversations to IDB, and (b) render a floating overlay (triggered by a keyboard shortcut) for one-keystroke "save current conversation to a space".

**Architecture:** A pair of content scripts (one per host) each mount a Shadow-DOM React subtree for the overlay and observe DOM mutations on the sidebar. They communicate with the background service worker via `chrome.runtime.sendMessage` — the background is the single IDB writer (content scripts never touch IDB directly). Background relays "spaces changed" pushes back so the overlay's space picker stays fresh.

**Permissions added:**
- `host_permissions: ['https://chatgpt.com/*', 'https://claude.ai/*']`
- `chrome.commands` for the overlay keyboard shortcut

**Default shortcut:** `Cmd+Shift+J` (Mac) / `Ctrl+Shift+J` (other). Note: ⌘+M conflicts with macOS minimise — picked the next memorable un-conflicted slot. The user can rebind via `chrome://extensions/shortcuts`.

---

## Phase 3 file additions

```
spacemind/
  entrypoints/
    content-chatgpt.content.ts    Content script for chatgpt.com
    content-claude.content.ts     Content script for claude.ai
    background.ts                 Extended with message router
  lib/
    sidebar-scrape/
      chatgpt.ts                  DOM selectors + MutationObserver
      claude.ts                   DOM selectors + MutationObserver
      types.ts                    ScrapedConversation shape (shared)
    overlay/
      mount.ts                    Shadow-DOM root creator, CSS injection
      Overlay.tsx                 React component (space picker + save)
      shortcut.ts                 Cross-platform shortcut binding
    runtime-messages.ts           Typed message schema (Zod) + client helpers
  components/
    (no new manager components — Phase 4)
  tests/
    lib/
      sidebar-scrape/
        chatgpt.test.ts           Parses HTML fixture → ScrapedConversation[]
        claude.test.ts            Same
      runtime-messages.test.ts    Zod schema round-trip
    fixtures/
      chatgpt-sidebar.html        Mini HTML snippet of the sidebar
      claude-sidebar.html         Same
```

---

### Task 1: Permissions + content script scaffolds

**Files:**
- Modify: `wxt.config.ts` — add `host_permissions` + `chrome.commands`
- Create: `entrypoints/content-chatgpt.content.ts`
- Create: `entrypoints/content-claude.content.ts`

- [ ] **Step 1: Update wxt.config.ts**

```ts
manifest: {
  // ...existing fields
  host_permissions: [
    'https://chatgpt.com/*',
    'https://claude.ai/*',
  ],
  commands: {
    'open-overlay': {
      suggested_key: {
        default: 'Ctrl+Shift+J',
        mac: 'Command+Shift+J',
      },
      description: 'Toggle SpaceMind overlay on supported AI sites',
    },
  },
}
```

- [ ] **Step 2: Empty content script scaffolds (just log "loaded" for now)**

```ts
// entrypoints/content-chatgpt.content.ts
export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  runAt: 'document_idle',
  main() {
    console.log('[SpaceMind] content script loaded on chatgpt.com')
  },
})
```

Mirror for `content-claude.content.ts` (matches: claude.ai).

- [ ] **Step 3: Build + verify content scripts inject**

```bash
pnpm build
```

Load unpacked → open chatgpt.com → DevTools console → confirm log line appears. Same for claude.ai.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(content): host permissions + empty content script scaffolds"
```

---

### Task 2: Typed runtime messages (TDD)

Background ↔ content script ↔ overlay all speak through this schema. Define it once with Zod so all sides agree.

**Files:**
- Create: `lib/runtime-messages.ts`
- Create: `tests/lib/runtime-messages.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/lib/runtime-messages.test.ts
import { describe, it, expect } from 'vitest'
import { RuntimeMessageSchema, type RuntimeMessage } from '@/lib/runtime-messages'

describe('RuntimeMessageSchema', () => {
  it('parses conversation:save-current', () => {
    const r = RuntimeMessageSchema.safeParse({
      kind: 'conversation:save-current',
      platform: 'chatgpt',
      conversation: { id: 'abc', url: 'https://chatgpt.com/c/abc', title: 'T' },
      spaceId: 'sp1',
    })
    expect(r.success).toBe(true)
  })

  it('parses spaces:list-request and spaces:list-reply', () => {
    expect(RuntimeMessageSchema.safeParse({ kind: 'spaces:list-request' }).success).toBe(true)
    expect(RuntimeMessageSchema.safeParse({
      kind: 'spaces:list-reply',
      spaces: [{ id: 's', name: 'X', color: 'indigo', createdAt: 0, updatedAt: 0 }],
    }).success).toBe(true)
  })

  it('parses conversations:batch-upsert from sidebar scraper', () => {
    expect(RuntimeMessageSchema.safeParse({
      kind: 'conversations:batch-upsert',
      platform: 'claude',
      conversations: [{ id: 'c1', url: 'https://claude.ai/chat/c1', title: 'T' }],
    }).success).toBe(true)
  })

  it('rejects unknown kind', () => {
    expect(RuntimeMessageSchema.safeParse({ kind: 'bogus' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Implement schema**

```ts
// lib/runtime-messages.ts
import { z } from 'zod'
import { PlatformSchema, SpaceSchema } from './schema'

// Minimal "scraped" shape — content script can't always see message bodies,
// so it sends just enough to identify the conversation.
export const ScrapedConversationSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  title: z.string(),
})
export type ScrapedConversation = z.infer<typeof ScrapedConversationSchema>

export const RuntimeMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('conversation:save-current'),
    platform: PlatformSchema,
    conversation: ScrapedConversationSchema,
    spaceId: z.string(),
  }),
  z.object({
    kind: z.literal('conversation:save-reply'),
    ok: z.boolean(),
    error: z.string().optional(),
  }),
  z.object({ kind: z.literal('spaces:list-request') }),
  z.object({
    kind: z.literal('spaces:list-reply'),
    spaces: z.array(SpaceSchema),
  }),
  z.object({
    kind: z.literal('conversations:batch-upsert'),
    platform: PlatformSchema,
    conversations: z.array(ScrapedConversationSchema),
  }),
])
export type RuntimeMessage = z.infer<typeof RuntimeMessageSchema>

// Typed sender helper for content scripts
export async function sendRuntimeMessage<T extends RuntimeMessage>(msg: T): Promise<RuntimeMessage | undefined> {
  const raw = await chrome.runtime.sendMessage(msg)
  if (raw === undefined) return undefined
  const parsed = RuntimeMessageSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}
```

- [ ] **Step 3: Run tests — green**
- [ ] **Step 4: Commit**

```bash
git commit -am "feat(messaging): Zod-typed runtime message schema"
```

---

### Task 3: ChatGPT sidebar scraper (TDD)

**Files:**
- Create: `lib/sidebar-scrape/chatgpt.ts`
- Create: `lib/sidebar-scrape/types.ts`
- Create: `tests/fixtures/chatgpt-sidebar.html`
- Create: `tests/lib/sidebar-scrape/chatgpt.test.ts`

- [ ] **Step 1: HTML fixture**

Build a minimal representative snippet of ChatGPT's sidebar (current 2026 markup; verify by inspecting chatgpt.com). The list items typically look like:

```html
<aside>
  <nav>
    <a href="/c/conv-1" class="...">Centering a div</a>
    <a href="/c/conv-2" class="...">Migrating to Vite</a>
    <a href="/c/conv-3" class="...">Random title</a>
  </nav>
</aside>
```

Hand-craft `tests/fixtures/chatgpt-sidebar.html`. Use selectors that target the `<a>` elements with `href^="/c/"`.

- [ ] **Step 2: Failing test**

```ts
// tests/lib/sidebar-scrape/chatgpt.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scrapeChatGPTSidebar } from '@/lib/sidebar-scrape/chatgpt'

const html = readFileSync(join(__dirname, '../../fixtures/chatgpt-sidebar.html'), 'utf8')

describe('scrapeChatGPTSidebar', () => {
  it('extracts conversation refs from anchor hrefs', () => {
    document.body.innerHTML = html
    const result = scrapeChatGPTSidebar(document)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      id: 'conv-1',
      url: 'https://chatgpt.com/c/conv-1',
      title: 'Centering a div',
    })
  })

  it('returns empty array when sidebar is missing', () => {
    document.body.innerHTML = '<div></div>'
    expect(scrapeChatGPTSidebar(document)).toEqual([])
  })

  it('dedupes anchors pointing to the same conversation id', () => {
    document.body.innerHTML = `
      <aside><nav>
        <a href="/c/x">T1</a>
        <a href="/c/x">T1 dup</a>
      </nav></aside>
    `
    const result = scrapeChatGPTSidebar(document)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('x')
  })
})
```

- [ ] **Step 3: Implement**

```ts
// lib/sidebar-scrape/chatgpt.ts
import type { ScrapedConversation } from '../runtime-messages'

const CONV_HREF = /^\/c\/([\w-]+)/

export function scrapeChatGPTSidebar(doc: Document = document): ScrapedConversation[] {
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href^="/c/"]'))
  const seen = new Set<string>()
  const result: ScrapedConversation[] = []
  for (const a of anchors) {
    const match = CONV_HREF.exec(a.getAttribute('href') ?? '')
    if (!match) continue
    const id = match[1]
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push({
      id,
      url: `https://chatgpt.com/c/${id}`,
      title: (a.textContent ?? '').trim() || id,
    })
  }
  return result
}

// MutationObserver helper — content script wires this up
export function subscribeChatGPTSidebar(
  onUpdate: (convs: ScrapedConversation[]) => void,
): () => void {
  const fire = () => onUpdate(scrapeChatGPTSidebar(document))
  fire()  // initial pass
  const observer = new MutationObserver(() => fire())
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
```

- [ ] **Step 4: Run — green**
- [ ] **Step 5: Commit**

```bash
git commit -am "feat(scrape): chatgpt sidebar parser + observer"
```

---

### Task 4: Claude sidebar scraper (TDD)

Same pattern as Task 3, different host. Claude's URL shape: `https://claude.ai/chat/<uuid>`. Sidebar links are `<a href="/chat/<uuid>">Title</a>`.

**Files:**
- Create: `lib/sidebar-scrape/claude.ts`
- Create: `tests/fixtures/claude-sidebar.html`
- Create: `tests/lib/sidebar-scrape/claude.test.ts`

Same structure as Task 3. Adjust selector + URL prefix.

- [ ] **Steps 1-5: as Task 3, replacing chatgpt → claude, `/c/` → `/chat/`**

- [ ] **Final commit:**

```bash
git commit -am "feat(scrape): claude sidebar parser + observer"
```

---

### Task 5: Background message router

**Files:**
- Modify: `entrypoints/background.ts`
- Modify: `lib/db.ts` — add `bulkUpsertScrapedConversations(platform, scraped)` that preserves user metadata on existing rows
- Create: `tests/lib/db-upsert-scraped.test.ts`

The background owns all IDB writes. It listens for `chrome.runtime.onMessage`, parses with our schema, dispatches.

- [ ] **Step 1: lib/db.ts — add upsert helper (TDD)**

```ts
// lib/db.ts additions
import type { Platform } from './schema'
import type { ScrapedConversation } from './runtime-messages'

export async function bulkUpsertScrapedConversations(
  platform: Platform,
  scraped: ScrapedConversation[],
  now: number,
): Promise<{ added: number; updated: number }> {
  if (scraped.length === 0) return { added: 0, updated: 0 }
  const db = await openDb()
  const tx = db.transaction('conversations', 'readwrite')
  const store = tx.objectStore('conversations')
  let added = 0
  let updated = 0
  for (const s of scraped) {
    const existing = await store.get(s.id)
    if (existing) {
      // Refresh title + capturedAt only when meaningfully changed; preserve everything user-set
      const next: Conversation = {
        ...existing,
        title: s.title || existing.title,
        url: s.url,
        platformUpdatedAt: now,
      }
      await store.put(next)
      updated++
    } else {
      const fresh: Conversation = {
        id: s.id,
        platform,
        url: s.url,
        title: s.title,
        tags: [],
        starred: false,
        capturedAt: now,
        platformUpdatedAt: now,
      }
      await store.put(fresh)
      added++
    }
  }
  await tx.done
  return { added, updated }
}
```

Tests: insert + re-insert pattern; verify user-set spaceId / tags / starred / note all survive.

- [ ] **Step 2: Implement background router**

```ts
// entrypoints/background.ts
import { RuntimeMessageSchema, type RuntimeMessage } from '@/lib/runtime-messages'
import { allSpaces, getConversation, putConversation, bulkUpsertScrapedConversations } from '@/lib/db'

export default defineBackground(() => {
  // Existing: open manager when toolbar clicked
  chrome.action.onClicked.addListener(/* ... existing handler ... */)

  // New: handle the overlay shortcut (Phase 3)
  chrome.commands.onCommand.addListener(async (cmd, tab) => {
    if (cmd !== 'open-overlay') return
    if (!tab?.id) return
    // Tell the content script in the active tab to show the overlay
    await chrome.tabs.sendMessage(tab.id, { kind: 'overlay:toggle' }).catch(() => {
      // No content script on this page — ignore silently
    })
  })

  // Router
  chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const parsed = RuntimeMessageSchema.safeParse(raw)
    if (!parsed.success) return false
    void handle(parsed.data).then(sendResponse)
    return true  // keep channel open for async sendResponse
  })

  async function handle(msg: RuntimeMessage): Promise<RuntimeMessage | undefined> {
    const now = Date.now()
    switch (msg.kind) {
      case 'spaces:list-request': {
        const spaces = await allSpaces()
        return { kind: 'spaces:list-reply', spaces }
      }
      case 'conversation:save-current': {
        const existing = await getConversation(msg.conversation.id)
        const conv = existing
          ? { ...existing, spaceId: msg.spaceId, platformUpdatedAt: now }
          : {
              id: msg.conversation.id,
              platform: msg.platform,
              url: msg.conversation.url,
              title: msg.conversation.title,
              spaceId: msg.spaceId,
              tags: [], starred: false,
              capturedAt: now, platformUpdatedAt: now,
            }
        try {
          await putConversation(conv)
          return { kind: 'conversation:save-reply', ok: true }
        } catch (e) {
          return { kind: 'conversation:save-reply', ok: false, error: (e as Error).message }
        }
      }
      case 'conversations:batch-upsert': {
        await bulkUpsertScrapedConversations(msg.platform, msg.conversations, now)
        return undefined  // fire-and-forget
      }
      default:
        return undefined
    }
  }
})
```

The `overlay:toggle` direction (background → content script) is a one-off — we don't need to add it to the discriminated union (it's purely content-script-internal). Keep it as a plain object with a `kind` tag.

- [ ] **Step 3: Run tests + manual smoke**

`pnpm test` should be green.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(background): runtime message router + sidebar upsert helper"
```

---

### Task 6: Overlay UI in Shadow DOM

This is the trickiest task. We mount a React subtree inside a Shadow Root to isolate from host page CSS, and we have to inject Tailwind into the shadow root.

**Files:**
- Create: `lib/overlay/mount.ts`
- Create: `lib/overlay/Overlay.tsx`
- Create: `lib/overlay/shortcut.ts`
- Create: `assets/overlay.css` (minimal Tailwind-imports, will be inlined as a string)
- Modify: `entrypoints/content-chatgpt.content.ts` + `content-claude.content.ts` — wire overlay mount + listen for `overlay:toggle`

- [ ] **Step 1: assets/overlay.css**

```css
@import 'tailwindcss';
@custom-variant dark (&:where(.dark, .dark *));
```

WXT can bundle this as a CSS string we inject into the shadow root via `<style>`.

- [ ] **Step 2: lib/overlay/mount.ts**

```ts
import { createRoot, type Root } from 'react-dom/client'
import React from 'react'
import { Overlay } from './Overlay'
import overlayCss from '@/assets/overlay.css?inline'  // WXT/Vite can `?inline` import CSS as string

const HOST_ID = '__spacemind_overlay_host__'

let mounted: { host: HTMLElement; root: Root } | null = null

export function ensureOverlayMounted(): void {
  if (mounted) return
  const host = document.createElement('div')
  host.id = HOST_ID
  host.style.cssText = 'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = overlayCss
  shadow.appendChild(style)

  const rootEl = document.createElement('div')
  rootEl.style.pointerEvents = 'auto'  // children can receive events
  shadow.appendChild(rootEl)

  const root = createRoot(rootEl)
  root.render(React.createElement(Overlay))

  mounted = { host, root }
}

export function unmountOverlay(): void {
  if (!mounted) return
  mounted.root.unmount()
  mounted.host.remove()
  mounted = null
}
```

- [ ] **Step 3: lib/overlay/Overlay.tsx**

A simple modal-style overlay:
- Listens to global shortcut events to toggle open
- On open: query spaces from background, focus search input
- Renders a Space picker (filter as you type)
- Enter → send `conversation:save-current` to background using current URL/title
- Esc → close

Code is somewhat long but conventional React + chrome.runtime usage. Implementer can follow this skeleton:

```tsx
import { useEffect, useState } from 'react'
import { sendRuntimeMessage } from '@/lib/runtime-messages'
import type { Space } from '@/lib/schema'

export function Overlay() {
  const [open, setOpen] = useState(false)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [query, setQuery] = useState('')

  // Listen for "overlay:toggle" from background
  useEffect(() => {
    const onMsg = (msg: unknown) => {
      if (msg && typeof msg === 'object' && (msg as { kind?: string }).kind === 'overlay:toggle') {
        setOpen((v) => !v)
      }
    }
    chrome.runtime.onMessage.addListener(onMsg)
    return () => chrome.runtime.onMessage.removeListener(onMsg)
  }, [])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Load spaces when opening
  useEffect(() => {
    if (!open) return
    void sendRuntimeMessage({ kind: 'spaces:list-request' }).then((reply) => {
      if (reply?.kind === 'spaces:list-reply') setSpaces(reply.spaces)
    })
  }, [open])

  if (!open) return null

  const platform = detectPlatform(location.href)
  const conv = currentConversation(platform)

  const filtered = spaces.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))

  const save = async (spaceId: string) => {
    if (!conv) return
    await sendRuntimeMessage({
      kind: 'conversation:save-current',
      platform,
      conversation: conv,
      spaceId,
    })
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-[420px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Save to space…"
          className="w-full px-4 py-3 text-sm bg-transparent border-b border-slate-200 dark:border-slate-700 outline-none"
        />
        <ul className="max-h-64 overflow-y-auto">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => void save(s.id)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {s.emoji} {s.name}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-xs text-slate-500">No spaces match.</li>
          )}
        </ul>
      </div>
    </div>
  )
}

function detectPlatform(href: string): 'chatgpt' | 'claude' {
  return href.includes('chatgpt.com') ? 'chatgpt' : 'claude'
}

function currentConversation(platform: 'chatgpt' | 'claude'): { id: string; url: string; title: string } | null {
  if (platform === 'chatgpt') {
    const match = /\/c\/([\w-]+)/.exec(location.pathname)
    if (!match || !match[1]) return null
    return { id: match[1], url: location.href, title: document.title }
  }
  const match = /\/chat\/([\w-]+)/.exec(location.pathname)
  if (!match || !match[1]) return null
  return { id: match[1], url: location.href, title: document.title }
}
```

- [ ] **Step 4: Wire content scripts**

```ts
// entrypoints/content-chatgpt.content.ts
import { ensureOverlayMounted } from '@/lib/overlay/mount'
import { subscribeChatGPTSidebar } from '@/lib/sidebar-scrape/chatgpt'
import { sendRuntimeMessage } from '@/lib/runtime-messages'

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  runAt: 'document_idle',
  main() {
    ensureOverlayMounted()
    // Debounced batch upsert when sidebar changes
    let timer: number | null = null
    subscribeChatGPTSidebar((convs) => {
      if (timer) clearTimeout(timer)
      timer = window.setTimeout(() => {
        void sendRuntimeMessage({
          kind: 'conversations:batch-upsert',
          platform: 'chatgpt',
          conversations: convs,
        })
      }, 800)
    })
  },
})
```

Mirror for claude.

- [ ] **Step 5: Build + manual verify**

```bash
pnpm build
```

Reload extension. Open chatgpt.com:
- Check DevTools console: no errors
- Press Cmd+Shift+J → overlay should appear, list of spaces visible
- Type a space name → filter works
- Enter → overlay closes, conversation saved
- Open manager → conversation appears in the chosen space
- Open conversation in chatgpt — should hit `conversations:batch-upsert` and the title appears in manager's Conversations list

Do the same on claude.ai.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(overlay): Cmd+Shift+J shadow-dom overlay + sidebar scraper wiring"
```

---

### Task 7: Manager UI surface for content-script captures

Phase 2 already shows the Conversations list. Phase 3 just needs to ensure:
- Scraped conversations (no preview / no messageCount) render gracefully
- Conversations saved-from-overlay appear in their space

If the Phase 2 list rendering already handles this, Task 7 may be a no-op. Verify:
- Scrape a conversation via sidebar → does it appear in manager?
- Save via overlay → does its `spaceId` link it visually to the space?

Phase 4 will style the space ↔ conversation relationship; Phase 3 just confirms the data flow.

- [ ] **Step 1: Inspect current App.tsx — confirm or patch**

If the conversations list doesn't currently filter by space, that's fine — Phase 3 just needs them visible. Optional: add a small indicator "(in: Engineering)" next to each title.

- [ ] **Step 2: Manual e2e test**

Full flow:
1. Open chatgpt.com → start a new conversation → wait 1s
2. Open manager → confirm the new title is in Conversations
3. Go back to chatgpt → Cmd+Shift+J → save current to "Engineering"
4. Open manager → confirm title shows up alongside the Engineering space

Document any UX gaps; defer fixes to Phase 4.

- [ ] **Step 3: Commit (if any tweaks)**

---

### Task 8: Phase 3 wrap-up

- [ ] **Step 1: Regression**

```bash
pnpm compile
pnpm test
pnpm build
```

- [ ] **Step 2: Tag + push**

```bash
git push origin main
git tag -a phase-3-done -m "Phase 3 complete: content scripts, sidebar scraping, Cmd+Shift+J overlay"
git push origin phase-3-done
```

---

## Phase 3 done criteria

- [ ] Content scripts inject on chatgpt.com + claude.ai
- [ ] Sidebar conversation list scraped and silently upserted to IDB
- [ ] Cmd+Shift+J overlay appears, lists spaces, saves current conversation
- [ ] Shadow DOM isolates overlay CSS from host page
- [ ] All tests still green (~125+ total)
- [ ] Build clean, pushed, `phase-3-done` tag on remote

---

## Open questions / known risks

1. **DOM brittleness**: ChatGPT and Claude redesign frequently. Selectors live in `lib/sidebar-scrape/*.ts` so a redesign is one-file to fix. Plan a "scraping paused" UI banner for Phase 4 when selectors break.
2. **Tailwind in Shadow DOM**: The `?inline` import works in Vite/WXT. If the build complains, fallback is to fetch the CSS file at runtime (one HTTP request, cached).
3. **MV3 SW eviction during bulk upsert**: If the user opens ChatGPT with 500+ sidebar entries, the batch upsert may run while SW is being evicted. The 800ms debounce mitigates; if it bites, switch to an offscreen document for IDB.
4. **`document.title` reliability**: On SPA navigations, the title may not update for a few hundred ms after URL change. The overlay's "save current" path reads title at the moment of save; this is fine.
5. **Shortcut conflicts**: Cmd+Shift+J is unbound on Mac and Chrome. Users can rebind via chrome://extensions/shortcuts.
