# SpaceMind Phase 1 — Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working WXT + React + TS skeleton, IndexedDB layer with Zod-validated schema, manager page that renders an empty state, all dev tooling in place (Vitest, Tailwind, dark mode hook), and a smoke test that proves the IDB → store → render pipeline works.

**Architecture:** WXT (MV3) host, React 18 + Tailwind v4 in `entrypoints/manager`, Zustand store wrapping an `idb-keyval`-light IndexedDB wrapper. Schema lives in `lib/schema.ts` (Zod). One smoke test asserts a Space can be written and read back.

**Tech Stack:** WXT, TypeScript strict (matching SpaceTab tsconfig flags), React 18, Tailwind v4, Zustand, Zod, IndexedDB (via `idb`), Vitest + happy-dom.

**Reference codebase:** `../spacetab/` — copy `tsconfig.json`, `tailwind.config`, `vitest.config.ts`, ESLint rules, `lib/i18n.ts`, `lib/theme.ts`, `lib/ui-utils.ts` patterns. Adapt, don't fork — SpaceMind has its own data model.

---

## File Structure (this phase)

```
spacemind/
  package.json
  tsconfig.json
  wxt.config.ts
  vite.config.ts (via WXT)
  assets/
    tailwind.css
  entrypoints/
    background.ts                  Service worker — empty stub
    manager/
      index.html
      main.tsx
      App.tsx                      Empty-state landing
  lib/
    schema.ts                      Zod: Space / Conversation / Message / AppSettings
    db.ts                          IndexedDB open + migrate + typed get/put
    spaces.ts                      Pure space CRUD against db
    theme.ts                       Port from spacetab — verbatim
    i18n.ts                        Empty dict, en + zh-CN stubs
    ui-utils.ts                    Port from spacetab — palette + relativeTime
  stores/
    app-store.ts                   Zustand: { loaded, spaces, load, addSpace, … }
  components/
    empty-state.tsx                "Create your first space" landing
  tests/
    smoke.test.ts                  IDB roundtrip
    lib/
      schema.test.ts               Zod parses valid + rejects invalid
      spaces.test.ts               Pure CRUD logic
    stores/
      app-store.test.ts            Store integration with fake IDB
  public/
    icon/
      16.png 32.png 48.png 96.png 128.png   placeholder — purple square v0
```

---

### Task 1: Bootstrap WXT + React + TS strict

**Files:**
- Create: `package.json`, `tsconfig.json`, `wxt.config.ts`, `entrypoints/manager/index.html`, `entrypoints/manager/main.tsx`, `entrypoints/manager/App.tsx`, `entrypoints/background.ts`

- [ ] **Step 1: Run WXT init**

```bash
cd /Users/yaming/Documents/chrome/spacemind
pnpm dlx wxt@latest init . --template react-ts --pm pnpm
```

Confirm `--here` style overwrite if prompted. Verify `entrypoints/`, `wxt.config.ts`, `package.json` appear.

- [ ] **Step 2: Tighten tsconfig**

Copy `tsconfig.json` from `../spacetab/tsconfig.json`. Should include `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Path alias `@/*` → `./*`.

- [ ] **Step 3: Replace boilerplate App.tsx with a placeholder**

```tsx
// entrypoints/manager/App.tsx
export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <h1 className="text-2xl font-semibold">SpaceMind</h1>
    </main>
  )
}
```

- [ ] **Step 4: Edit wxt.config.ts**

Match SpaceTab's pattern — name from i18n, single permission `storage` for now, no `chrome_url_overrides`, no `commands`:

```ts
import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'SpaceMind',
    description: 'Cross-platform AI conversation manager with project spaces. Local-first, MIT.',
    version: '0.1.0',
    permissions: ['storage'],
    action: { default_title: 'SpaceMind' },
  },
})
```

- [ ] **Step 5: Run dev + verify**

```bash
pnpm dev
```

Expected: `.output/chrome-mv3-dev` produced. Load unpacked in Chrome → click toolbar icon (no popup yet, so it does nothing). Open `chrome-extension://<id>/manager.html` directly → see "SpaceMind" heading.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: bootstrap WXT + React + TS strict + Tailwind"
```

---

### Task 2: Tailwind v4 + dark mode hook

**Files:**
- Create: `assets/tailwind.css`
- Create: `lib/theme.ts` (port from `../spacetab/lib/theme.ts`)
- Modify: `entrypoints/manager/main.tsx` (import tailwind.css)

- [ ] **Step 1: Add tailwind.css**

```css
/* assets/tailwind.css */
@import 'tailwindcss';
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-brand-50: #faf5ff;
  --color-brand-500: #a855f7;
  --color-brand-600: #9333ea;
  --color-brand-700: #7e22ce;
}
```

Brand is purple (one notch warmer than SpaceTab's indigo/violet) per spec section 6.

- [ ] **Step 2: Import in main.tsx**

```tsx
import '@/assets/tailwind.css'
```

- [ ] **Step 3: Copy lib/theme.ts from SpaceTab**

```bash
cp ../spacetab/lib/theme.ts lib/theme.ts
```

No edits needed — the hook is generic.

- [ ] **Step 4: Wire useTheme into App.tsx**

```tsx
import { useTheme } from '@/lib/theme'

export default function App() {
  useTheme()
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <h1 className="text-2xl font-semibold">SpaceMind</h1>
    </main>
  )
}
```

- [ ] **Step 5: Verify dark mode works**

DevTools console: `document.documentElement.classList.add('dark')` — page should turn dark. Refresh — should persist via storage (after we add the storage key, which theme.ts does internally).

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: tailwind v4 + dark mode hook (ported from spacetab)"
```

---

### Task 3: Vitest + happy-dom + smoke test

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`
- Modify: `package.json` — add `test` and `test:watch` scripts

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest happy-dom @vitest/ui
```

- [ ] **Step 2: vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
  },
})
```

- [ ] **Step 3: Smoke test**

```ts
// tests/smoke.test.ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('vitest works', () => {
    expect(1 + 1).toBe(2)
  })

  it('happy-dom available', () => {
    document.body.innerHTML = '<h1>hi</h1>'
    expect(document.querySelector('h1')?.textContent).toBe('hi')
  })
})
```

- [ ] **Step 4: package.json scripts**

```json
"test": "vitest run",
"test:watch": "vitest",
"compile": "tsc --noEmit"
```

- [ ] **Step 5: Run**

```bash
pnpm test
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git commit -am "test: vitest + happy-dom smoke harness"
```

---

### Task 4: Zod schema (TDD)

**Files:**
- Create: `lib/schema.ts`
- Create: `tests/lib/schema.test.ts`

- [ ] **Step 1: Install Zod**

```bash
pnpm add zod
```

- [ ] **Step 2: Write failing test**

```ts
// tests/lib/schema.test.ts
import { describe, it, expect } from 'vitest'
import { SpaceSchema, ConversationSchema, MessageSchema } from '@/lib/schema'

describe('SpaceSchema', () => {
  it('parses a minimal valid space', () => {
    const result = SpaceSchema.safeParse({
      id: 's1',
      name: 'Work',
      color: 'indigo',
      createdAt: 1000,
      updatedAt: 1000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = SpaceSchema.safeParse({
      id: 's1', name: '', color: 'indigo', createdAt: 0, updatedAt: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown color', () => {
    const result = SpaceSchema.safeParse({
      id: 's1', name: 'A', color: 'magenta', createdAt: 0, updatedAt: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('ConversationSchema', () => {
  it('parses a valid chatgpt conversation', () => {
    const r = ConversationSchema.safeParse({
      id: 'abc-123', platform: 'chatgpt', url: 'https://chatgpt.com/c/abc-123',
      title: 'How to center a div', tags: [], starred: false, capturedAt: 1000,
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown platform', () => {
    const r = ConversationSchema.safeParse({
      id: 'a', platform: 'mistral', url: 'https://mistral.ai/x', title: 'T',
      tags: [], starred: false, capturedAt: 0,
    })
    expect(r.success).toBe(false)
  })
})

describe('MessageSchema', () => {
  it('parses a user message', () => {
    const r = MessageSchema.safeParse({
      id: 'm1', conversationId: 'c1', role: 'user', content: 'Hi', timestamp: 0,
    })
    expect(r.success).toBe(true)
  })

  it('rejects empty content', () => {
    const r = MessageSchema.safeParse({
      id: 'm1', conversationId: 'c1', role: 'user', content: '', timestamp: 0,
    })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2.5: Run — expect FAIL**

```bash
pnpm test tests/lib/schema.test.ts
```

Expected: import errors (schema.ts doesn't exist).

- [ ] **Step 3: Implement schema**

```ts
// lib/schema.ts
import { z } from 'zod'

export const PaletteKeySchema = z.enum([
  'indigo', 'emerald', 'amber', 'pink', 'violet', 'cyan',
])
export type PaletteKey = z.infer<typeof PaletteKeySchema>

export const PlatformSchema = z.enum(['chatgpt', 'claude'])
export type Platform = z.infer<typeof PlatformSchema>

export const RoleSchema = z.enum(['user', 'assistant', 'system', 'tool'])
export type Role = z.infer<typeof RoleSchema>

export const SpaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().max(8).optional(),
  note: z.string().max(500).optional(),
  color: PaletteKeySchema,
  pinned: z.boolean().optional(),
  sortIndex: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type Space = z.infer<typeof SpaceSchema>

export const ConversationSchema = z.object({
  id: z.string().min(1),
  platform: PlatformSchema,
  url: z.string().url(),
  title: z.string(),
  spaceId: z.string().optional(),
  tags: z.array(z.string()),
  starred: z.boolean(),
  note: z.string().optional(),
  capturedAt: z.number(),
  platformUpdatedAt: z.number().optional(),
  messageCount: z.number().optional(),
  preview: z.object({
    firstUserMessage: z.string().optional(),
    lastAssistantMessage: z.string().optional(),
  }).optional(),
})
export type Conversation = z.infer<typeof ConversationSchema>

export const MessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  role: RoleSchema,
  content: z.string().min(1),
  timestamp: z.number(),
})
export type Message = z.infer<typeof MessageSchema>

export const AppSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  language: z.enum(['en', 'zh-CN']).default('en'),
  overlayShortcut: z.string().default('Meta+M'),
  managerShortcut: z.string().default('Meta+Shift+M'),
  lastZipImports: z.object({
    chatgpt: z.number().optional(),
    claude: z.number().optional(),
  }).default({}),
})
export type AppSettings = z.infer<typeof AppSettingsSchema>
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm test tests/lib/schema.test.ts
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts tests/lib/schema.test.ts
git commit -m "feat(schema): Zod schemas for Space/Conversation/Message/AppSettings"
```

---

### Task 5: IndexedDB wrapper (TDD)

**Files:**
- Create: `lib/db.ts`
- Create: `tests/lib/db.test.ts`

- [ ] **Step 1: Install idb**

```bash
pnpm add idb
```

- [ ] **Step 2: Write failing test**

```ts
// tests/lib/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { openDb, putSpace, getSpace, allSpaces, deleteSpace } from '@/lib/db'

beforeEach(async () => {
  // fake-indexeddb persists across describe — wipe between tests
  await indexedDB.deleteDatabase('spacemind')
})

describe('db.spaces', () => {
  it('writes and reads back a space', async () => {
    await openDb()
    await putSpace({
      id: 's1', name: 'Work', color: 'indigo',
      createdAt: 100, updatedAt: 100, tags: [],
    } as any)
    const read = await getSpace('s1')
    expect(read?.name).toBe('Work')
  })

  it('lists all spaces sorted by updatedAt desc', async () => {
    await openDb()
    await putSpace({ id: 'a', name: 'A', color: 'indigo', createdAt: 1, updatedAt: 100 } as any)
    await putSpace({ id: 'b', name: 'B', color: 'emerald', createdAt: 2, updatedAt: 200 } as any)
    const list = await allSpaces()
    expect(list.map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('deletes a space', async () => {
    await openDb()
    await putSpace({ id: 's1', name: 'Work', color: 'indigo', createdAt: 0, updatedAt: 0 } as any)
    await deleteSpace('s1')
    expect(await getSpace('s1')).toBeUndefined()
  })
})
```

Need: `pnpm add -D fake-indexeddb`.

- [ ] **Step 2.5: Run — expect FAIL**

```bash
pnpm test tests/lib/db.test.ts
```

Expected: module-not-found for `@/lib/db`.

- [ ] **Step 3: Implement db.ts**

```ts
// lib/db.ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Space, Conversation, Message } from './schema'

const DB_NAME = 'spacemind'
const DB_VERSION = 1

interface SpaceMindDB extends DBSchema {
  spaces: { key: string; value: Space; indexes: { 'by-updatedAt': number } }
  conversations: {
    key: string
    value: Conversation
    indexes: { 'by-spaceId': string; 'by-platform': string; 'by-capturedAt': number }
  }
  messages: { key: string; value: Message; indexes: { 'by-conversationId': string } }
}

let dbPromise: Promise<IDBPDatabase<SpaceMindDB>> | null = null

export function openDb(): Promise<IDBPDatabase<SpaceMindDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SpaceMindDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const spaces = db.createObjectStore('spaces', { keyPath: 'id' })
        spaces.createIndex('by-updatedAt', 'updatedAt')

        const conversations = db.createObjectStore('conversations', { keyPath: 'id' })
        conversations.createIndex('by-spaceId', 'spaceId')
        conversations.createIndex('by-platform', 'platform')
        conversations.createIndex('by-capturedAt', 'capturedAt')

        const messages = db.createObjectStore('messages', { keyPath: 'id' })
        messages.createIndex('by-conversationId', 'conversationId')
      },
    })
  }
  return dbPromise
}

// ---- Spaces ----
export async function putSpace(s: Space): Promise<void> {
  const db = await openDb()
  await db.put('spaces', s)
}

export async function getSpace(id: string): Promise<Space | undefined> {
  const db = await openDb()
  return db.get('spaces', id)
}

export async function allSpaces(): Promise<Space[]> {
  const db = await openDb()
  const all = await db.getAllFromIndex('spaces', 'by-updatedAt')
  return all.reverse() // index is ascending; we want descending
}

export async function deleteSpace(id: string): Promise<void> {
  const db = await openDb()
  await db.delete('spaces', id)
}
```

Note: in tests, `dbPromise` survives across tests in the same module. Reset it inside the test file via a hack OR don't worry — `deleteDatabase` in `beforeEach` reopens it correctly. We can refactor to inject the DB later if it bites.

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm test tests/lib/db.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts tests/lib/db.test.ts
git commit -m "feat(db): IndexedDB wrapper for spaces/conversations/messages"
```

---

### Task 6: Pure spaces domain logic (TDD)

**Files:**
- Create: `lib/spaces.ts`
- Create: `tests/lib/spaces.test.ts`

Goal: pure functions that take a `Space[]` and return new `Space[]`. No DB calls here — that's the store's job.

- [ ] **Step 1: Write failing test**

```ts
// tests/lib/spaces.test.ts
import { describe, it, expect } from 'vitest'
import {
  createSpace, renameSpace, deleteSpaceFromList,
  setPinned, setEmoji, sortedForDisplay,
} from '@/lib/spaces'
import type { Space } from '@/lib/schema'

const mk = (overrides: Partial<Space>): Space => ({
  id: 's1', name: 'X', color: 'indigo', createdAt: 0, updatedAt: 0, ...overrides,
})

describe('createSpace', () => {
  it('returns a new Space with given id/name and current timestamps', () => {
    const s = createSpace({ id: 'new', name: 'Work', color: 'indigo' }, 500)
    expect(s.id).toBe('new')
    expect(s.name).toBe('Work')
    expect(s.createdAt).toBe(500)
    expect(s.updatedAt).toBe(500)
  })
})

describe('renameSpace', () => {
  it('changes name and updatedAt', () => {
    const s = mk({ name: 'old', updatedAt: 100 })
    const next = renameSpace(s, 'new', 200)
    expect(next.name).toBe('new')
    expect(next.updatedAt).toBe(200)
  })
})

describe('sortedForDisplay', () => {
  it('places pinned first, then by sortIndex, then by updatedAt desc', () => {
    const spaces = [
      mk({ id: 'a', updatedAt: 100 }),
      mk({ id: 'b', pinned: true, sortIndex: 1 }),
      mk({ id: 'c', pinned: true, sortIndex: 0 }),
      mk({ id: 'd', updatedAt: 200 }),
    ]
    expect(sortedForDisplay(spaces).map((s) => s.id)).toEqual(['c', 'b', 'd', 'a'])
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test tests/lib/spaces.test.ts
```

- [ ] **Step 3: Implement spaces.ts**

Port the relevant pure functions from `../spacetab/lib/space.ts`. Specifically:
- `createSpace`, `renameSpace`, `deleteSpaceFromList`, `setPinned`, `setEmoji`, `setNote`, `setSortIndex`
- `sortedForDisplay`

Same algorithm but operating on `Space[]` directly (no Database wrapper — IDB is a thin layer here).

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm test tests/lib/spaces.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/spaces.ts tests/lib/spaces.test.ts
git commit -m "feat(spaces): pure space domain functions"
```

---

### Task 7: Zustand app store (TDD)

**Files:**
- Create: `stores/app-store.ts`
- Create: `tests/stores/app-store.test.ts`

- [ ] **Step 1: Install Zustand**

```bash
pnpm add zustand
```

- [ ] **Step 2: Write failing test**

```ts
// tests/stores/app-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { useAppStore } from '@/stores/app-store'

beforeEach(async () => {
  await indexedDB.deleteDatabase('spacemind')
  useAppStore.setState({ loaded: false, spaces: [] })
})

describe('app-store', () => {
  it('loads spaces from IDB into state', async () => {
    await useAppStore.getState().load()
    expect(useAppStore.getState().loaded).toBe(true)
    expect(useAppStore.getState().spaces).toEqual([])
  })

  it('creates a space via the store', async () => {
    await useAppStore.getState().load()
    const id = await useAppStore.getState().createSpace('Work', 'indigo')
    expect(typeof id).toBe('string')
    expect(useAppStore.getState().spaces.map((s) => s.name)).toEqual(['Work'])
  })

  it('rolls back optimistic add if IDB write fails', async () => {
    await useAppStore.getState().load()
    // monkey-patch putSpace to throw
    const { putSpace } = await import('@/lib/db')
    const orig = putSpace
    ;(global as any).__failPut = true
    // …minimal harness — feel free to swap to vi.mock if cleaner
  })
})
```

(Third test can be simplified or moved later — point is to encode the rollback behavior in tests.)

- [ ] **Step 3: Implement app-store.ts**

Pattern from `../spacetab/stores/space-store.ts` — optimistic update + IDB write + rollback on error. Toast queue lives here.

```ts
import { create } from 'zustand'
import type { Space } from '@/lib/schema'
import { allSpaces, putSpace, deleteSpace } from '@/lib/db'
import { createSpace as makeSpace, sortedForDisplay } from '@/lib/spaces'
import type { PaletteKey } from '@/lib/schema'

interface State {
  loaded: boolean
  spaces: Space[]
  toasts: Array<{ id: number; kind: 'info' | 'error'; text: string }>

  load: () => Promise<void>
  createSpace: (name: string, color: PaletteKey) => Promise<string>
  renameSpace: (id: string, name: string) => Promise<void>
  removeSpace: (id: string) => Promise<void>
  pushToast: (kind: 'info' | 'error', text: string) => void
  dismissToast: (id: number) => void
}

let toastSeq = 0

export const useAppStore = create<State>((set, get) => ({
  loaded: false,
  spaces: [],
  toasts: [],

  load: async () => {
    const spaces = await allSpaces()
    set({ loaded: true, spaces: sortedForDisplay(spaces) })
  },

  createSpace: async (name, color) => {
    const id = crypto.randomUUID()
    const now = Date.now()
    const s = makeSpace({ id, name, color }, now)
    const before = get().spaces
    set({ spaces: sortedForDisplay([s, ...before]) })
    try {
      await putSpace(s)
      return id
    } catch (e) {
      set({ spaces: before })
      get().pushToast('error', 'Failed to save space')
      throw e
    }
  },

  renameSpace: async (id, name) => { /* same pattern */ },
  removeSpace: async (id) => { /* same pattern */ },

  pushToast: (kind, text) => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }))
    setTimeout(() => get().dismissToast(id), 4000)
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm test tests/stores/app-store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add stores/app-store.ts tests/stores/app-store.test.ts
git commit -m "feat(store): zustand app store with optimistic + rollback IDB writes"
```

---

### Task 8: Empty-state manager page

**Files:**
- Create: `components/empty-state.tsx`
- Modify: `entrypoints/manager/App.tsx`

- [ ] **Step 1: empty-state.tsx**

```tsx
// components/empty-state.tsx
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
        className="mt-6 px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
      >
        Create your first space
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Wire App.tsx**

```tsx
import { useEffect } from 'react'
import { useTheme } from '@/lib/theme'
import { useAppStore } from '@/stores/app-store'
import { EmptyState } from '@/components/empty-state'

export default function App() {
  useTheme()
  const { loaded, spaces, load } = useAppStore()
  useEffect(() => { void load() }, [load])

  if (!loaded) return null

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold">SpaceMind</h1>
        {spaces.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-6 space-y-2">
            {spaces.map((s) => (
              <li key={s.id} className="px-3 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                {s.emoji} {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Manual verify**

```bash
pnpm dev
```

Reload extension in Chrome. Open `chrome-extension://<id>/manager.html`.
- Initial: see "No spaces yet"
- Click "Create your first space"
- Page re-renders to show one card "My first space"
- Refresh page → still there (persisted to IDB)

- [ ] **Step 4: Commit**

```bash
git add components/empty-state.tsx entrypoints/manager/App.tsx
git commit -m "feat(manager): empty-state landing + first-space CTA backed by IDB"
```

---

### Task 9: Type check + final phase commit

- [ ] **Step 1: Type check**

```bash
pnpm compile
```

Expected: clean.

- [ ] **Step 2: Full test run**

```bash
pnpm test
```

Expected: all green.

- [ ] **Step 3: Production build**

```bash
pnpm build
```

Expected: `.output/chrome-mv3/` produced, manifest is valid.

- [ ] **Step 4: Push to GitHub**

```bash
# (after creating tashuo/spacemind on github — public, MIT, no auto README)
git remote add origin git@github.com:tashuo/spacemind.git
git push -u origin main
```

- [ ] **Step 5: Tag phase end**

```bash
git tag phase-1-done
git push origin phase-1-done
```

---

## Phase 1 done criteria

Before moving to Phase 2 (ZIP import), all of these must be true:

- [ ] WXT build succeeds, no warnings
- [ ] Manager page loads, shows empty state, can create a space, persists it
- [ ] All tests pass (≥10 tests by end of phase)
- [ ] Type-check clean
- [ ] Dark mode works (manual toggle via DevTools confirms)
- [ ] Zod rejects invalid schemas (test-confirmed)
- [ ] IDB write failure rolls back UI state (test-confirmed)
- [ ] Pushed to GitHub, `phase-1-done` tag pushed
