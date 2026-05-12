# SpaceMind Phase 2 — ZIP Import + Search

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse ChatGPT + Claude conversation export ZIPs, normalize to our schema, bulk-insert to IndexedDB, and stand up FlexSearch over titles + full message content. By end of phase, dropping a ZIP into the manager populates the DB and search returns hits from message bodies.

**Architecture:** `JSZip` reads the archive, two pure parsers (one per vendor) emit `{ conversations, messages }`, the store's new `importFromZip` action does the bulk insert + index update, `lib/search.ts` wraps `FlexSearch` with two indexes (one for `conversations` keyed by title+preview, one for `messages` keyed by content).

**Tech Stack additions:** JSZip 3.x (zip read), FlexSearch 0.7.x (full-text index).

**Reference:** Phase 1 set up schema, IDB wrapper, store. We extend the store with bulk insert + search registration. No content-script work here (Phase 3).

---

## Phase 2 file additions

```
spacemind/
  lib/
    zip-import/
      chatgpt.ts            OpenAI parser: conversations.json + mapping tree → flat messages
      claude.ts             Anthropic parser: chat_messages array → flat messages
      index.ts              JSZip extract + vendor detect + dispatch
    search.ts               FlexSearch wrapper (conversations + messages)
  stores/
    app-store.ts            Extended with importFromZip, search, importing flag
  components/
    onboarding-dialog.tsx   Welcome + drag/drop ZIP UX
    import-progress.tsx     Inline progress bar
  tests/
    lib/
      zip-import/
        chatgpt.test.ts
        claude.test.ts
        index.test.ts
      search.test.ts
    stores/
      app-store-import.test.ts
    fixtures/
      chatgpt-export-sample.json
      claude-export-sample.json
```

---

### Task 1: Sample fixtures (canonical export shape)

Both parsers depend on a clear contract for the input JSON. Hand-craft minimal-but-realistic fixtures based on the documented export formats.

**Files:**
- Create: `tests/fixtures/chatgpt-export-sample.json`
- Create: `tests/fixtures/claude-export-sample.json`

- [ ] **Step 1: ChatGPT fixture**

Two conversations, one with a single linear thread, one with an edit-fork (two assistant branches off the same user message — `current_node` selects which branch is "live"):

```json
[
  {
    "title": "How to center a div",
    "create_time": 1714900000.0,
    "update_time": 1714900500.0,
    "conversation_id": "c-conv-1",
    "current_node": "m-3",
    "mapping": {
      "m-0": { "id": "m-0", "message": null, "parent": null, "children": ["m-1"] },
      "m-1": {
        "id": "m-1",
        "message": {
          "id": "m-1",
          "author": { "role": "user" },
          "content": { "content_type": "text", "parts": ["How do I center a div?"] },
          "create_time": 1714900010.0
        },
        "parent": "m-0",
        "children": ["m-2"]
      },
      "m-2": {
        "id": "m-2",
        "message": {
          "id": "m-2",
          "author": { "role": "assistant" },
          "content": { "content_type": "text", "parts": ["Use flexbox with justify-content and align-items."] },
          "create_time": 1714900020.0
        },
        "parent": "m-1",
        "children": ["m-3"]
      },
      "m-3": {
        "id": "m-3",
        "message": {
          "id": "m-3",
          "author": { "role": "user" },
          "content": { "content_type": "text", "parts": ["Thanks!"] },
          "create_time": 1714900030.0
        },
        "parent": "m-2",
        "children": []
      }
    }
  },
  {
    "title": "Greet in French",
    "create_time": 1714903000.0,
    "update_time": 1714903100.0,
    "conversation_id": "c-conv-2",
    "current_node": "m-b2",
    "mapping": {
      "m-a0": { "id": "m-a0", "message": null, "parent": null, "children": ["m-a1"] },
      "m-a1": {
        "id": "m-a1",
        "message": {
          "id": "m-a1",
          "author": { "role": "user" },
          "content": { "content_type": "text", "parts": ["Say hi"] },
          "create_time": 1714903010.0
        },
        "parent": "m-a0",
        "children": ["m-b1", "m-b2"]
      },
      "m-b1": {
        "id": "m-b1",
        "message": {
          "id": "m-b1",
          "author": { "role": "assistant" },
          "content": { "content_type": "text", "parts": ["Hello!"] },
          "create_time": 1714903020.0
        },
        "parent": "m-a1",
        "children": []
      },
      "m-b2": {
        "id": "m-b2",
        "message": {
          "id": "m-b2",
          "author": { "role": "assistant" },
          "content": { "content_type": "text", "parts": ["Bonjour!"] },
          "create_time": 1714903030.0
        },
        "parent": "m-a1",
        "children": []
      }
    }
  }
]
```

Key contract points the parser must respect:
- `current_node` is the leaf the user last selected — walk back to root through `parent`s to assemble the live thread, ignoring sibling forks
- `message: null` nodes (e.g., `m-0`) are roots/separators, skip them
- `content.parts` is an array; concatenate with `\n` (preserves multi-part messages)
- `content.content_type !== 'text'` (e.g., image_asset_pointer, code, tool calls): skip in v1 (later phases can add)
- Timestamps come in epoch SECONDS — convert to milliseconds for our schema

- [ ] **Step 2: Claude fixture**

```json
[
  {
    "uuid": "cv-1",
    "name": "Tailwind dark mode setup",
    "created_at": "2025-08-15T09:00:00Z",
    "updated_at": "2025-08-15T09:05:00Z",
    "chat_messages": [
      {
        "uuid": "msg-1",
        "text": "How do I add dark mode in Tailwind v4?",
        "sender": "human",
        "created_at": "2025-08-15T09:00:10Z"
      },
      {
        "uuid": "msg-2",
        "text": "Use @custom-variant dark with a .dark class selector.",
        "sender": "assistant",
        "created_at": "2025-08-15T09:00:30Z"
      }
    ]
  },
  {
    "uuid": "cv-2",
    "name": "Recipe ideas",
    "created_at": "2025-08-20T18:00:00Z",
    "updated_at": "2025-08-20T18:15:00Z",
    "chat_messages": [
      {
        "uuid": "msg-a",
        "text": "Three vegetarian dinner ideas?",
        "sender": "human",
        "created_at": "2025-08-20T18:00:00Z"
      },
      {
        "uuid": "msg-b",
        "text": "1. Roasted vegetable pasta. 2. Lentil curry. 3. Mushroom risotto.",
        "sender": "assistant",
        "created_at": "2025-08-20T18:00:45Z"
      }
    ]
  }
]
```

Key contract points:
- `chat_messages` is already linear, no tree walk
- `sender` is `'human' | 'assistant'` — map `human` → `'user'` for our schema
- `created_at` is ISO-8601 — convert via `Date.parse()` to ms
- `name` is the title (Claude calls it `name`, OpenAI calls it `title`)
- Newer Claude exports may include `attachments` or `files_v2` — ignore in v1

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/chatgpt-export-sample.json tests/fixtures/claude-export-sample.json
git commit -m "test(fixtures): minimal ChatGPT + Claude export samples"
```

---

### Task 2: ChatGPT parser (TDD)

**Files:**
- Create: `lib/zip-import/chatgpt.ts`
- Create: `tests/lib/zip-import/chatgpt.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/zip-import/chatgpt.test.ts
import { describe, it, expect } from 'vitest'
import { parseChatGPTExport } from '@/lib/zip-import/chatgpt'
import sample from '../../fixtures/chatgpt-export-sample.json'

describe('parseChatGPTExport', () => {
  it('flattens a linear conversation', () => {
    const result = parseChatGPTExport(sample)
    const conv = result.conversations.find((c) => c.title === 'How to center a div')
    expect(conv).toBeDefined()
    const messages = result.messages.filter((m) => m.conversationId === conv!.id)
    expect(messages.map((m) => m.content)).toEqual([
      'How do I center a div?',
      'Use flexbox with justify-content and align-items.',
      'Thanks!',
    ])
  })

  it('walks current_node back to root, ignoring forked siblings', () => {
    const result = parseChatGPTExport(sample)
    const conv = result.conversations.find((c) => c.title === 'Greet in French')!
    const messages = result.messages.filter((m) => m.conversationId === conv.id)
    expect(messages.map((m) => m.content)).toEqual(['Say hi', 'Bonjour!'])
    expect(messages.find((m) => m.content === 'Hello!')).toBeUndefined()
  })

  it('produces Conversation rows with the correct shape', () => {
    const result = parseChatGPTExport(sample)
    const conv = result.conversations[0]!
    expect(conv.platform).toBe('chatgpt')
    expect(conv.url).toMatch(/^https:\/\/chatgpt\.com\/c\//)
    expect(conv.tags).toEqual([])
    expect(conv.starred).toBe(false)
    expect(typeof conv.capturedAt).toBe('number')
    expect(typeof conv.platformUpdatedAt).toBe('number')
  })

  it('populates preview.firstUserMessage and preview.lastAssistantMessage', () => {
    const result = parseChatGPTExport(sample)
    const conv = result.conversations.find((c) => c.title === 'How to center a div')!
    expect(conv.preview?.firstUserMessage).toBe('How do I center a div?')
    expect(conv.preview?.lastAssistantMessage).toBe(
      'Use flexbox with justify-content and align-items.',
    )
  })

  it('converts epoch-seconds timestamps to milliseconds', () => {
    const result = parseChatGPTExport(sample)
    const conv = result.conversations[0]!
    // 1714900500 * 1000 = 1714900500000
    expect(conv.platformUpdatedAt).toBe(1714900500000)
  })

  it('returns empty arrays for empty input', () => {
    const result = parseChatGPTExport([])
    expect(result.conversations).toEqual([])
    expect(result.messages).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm test tests/lib/zip-import/chatgpt.test.ts
```

- [ ] **Step 3: Implement parser**

```ts
// lib/zip-import/chatgpt.ts
import type { Conversation, Message } from '../schema'

interface MappingNode {
  id: string
  message: {
    id: string
    author: { role: string }
    content: { content_type: string; parts: unknown[] }
    create_time: number | null
  } | null
  parent: string | null
  children: string[]
}

interface RawChatGPTConv {
  title: string
  create_time: number  // epoch seconds
  update_time: number
  conversation_id: string
  current_node: string
  mapping: Record<string, MappingNode>
}

export function parseChatGPTExport(
  raw: RawChatGPTConv[],
): { conversations: Conversation[]; messages: Message[] } {
  const now = Date.now()
  const conversations: Conversation[] = []
  const messages: Message[] = []

  for (const c of raw) {
    const thread = walkCurrentPath(c)
    if (thread.length === 0) continue  // no live messages, skip

    const convId = c.conversation_id
    const firstUser = thread.find((m) => m.role === 'user')?.content
    const lastAssistant = [...thread].reverse().find((m) => m.role === 'assistant')?.content

    const conv: Conversation = {
      id: convId,
      platform: 'chatgpt',
      url: `https://chatgpt.com/c/${convId}`,
      title: c.title,
      tags: [],
      starred: false,
      capturedAt: now,
      platformUpdatedAt: Math.round(c.update_time * 1000),
      messageCount: thread.length,
      preview: {
        ...(firstUser !== undefined ? { firstUserMessage: truncate(firstUser, 200) } : {}),
        ...(lastAssistant !== undefined ? { lastAssistantMessage: truncate(lastAssistant, 200) } : {}),
      },
    }
    conversations.push(conv)

    for (const m of thread) {
      messages.push({
        id: `${convId}:${m.id}`,  // composite — guarantees uniqueness across conversations
        conversationId: convId,
        role: m.role,
        content: m.content,
        timestamp: Math.round((m.timestamp ?? 0) * 1000),
      })
    }
  }

  return { conversations, messages }
}

// Walk current_node back to root, then reverse → root-to-leaf message order
function walkCurrentPath(c: RawChatGPTConv): Array<{
  id: string
  role: Message['role']
  content: string
  timestamp: number | null
}> {
  const path: Array<{ id: string; role: Message['role']; content: string; timestamp: number | null }> = []
  let cursor: string | null = c.current_node
  const seen = new Set<string>()  // cycle guard, defensive
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    const node = c.mapping[cursor]
    if (!node) break
    if (node.message) {
      const role = normalizeRole(node.message.author.role)
      const content = extractText(node.message.content)
      if (role && content !== null) {
        path.push({
          id: node.message.id,
          role,
          content,
          timestamp: node.message.create_time,
        })
      }
    }
    cursor = node.parent
  }
  return path.reverse()
}

function normalizeRole(raw: string): Message['role'] | null {
  if (raw === 'user' || raw === 'assistant' || raw === 'system' || raw === 'tool') return raw
  return null
}

function extractText(content: { content_type: string; parts: unknown[] } | null): string | null {
  if (!content) return null
  if (content.content_type !== 'text') return null
  return content.parts.filter((p): p is string => typeof p === 'string').join('\n')
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm test tests/lib/zip-import/chatgpt.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/zip-import/chatgpt.ts tests/lib/zip-import/chatgpt.test.ts
git commit -m "feat(zip): ChatGPT export parser (mapping-tree → linear thread)"
```

---

### Task 3: Claude parser (TDD)

**Files:**
- Create: `lib/zip-import/claude.ts`
- Create: `tests/lib/zip-import/claude.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/zip-import/claude.test.ts
import { describe, it, expect } from 'vitest'
import { parseClaudeExport } from '@/lib/zip-import/claude'
import sample from '../../fixtures/claude-export-sample.json'

describe('parseClaudeExport', () => {
  it('flattens chat_messages with mapped roles', () => {
    const result = parseClaudeExport(sample)
    const conv = result.conversations.find((c) => c.title === 'Tailwind dark mode setup')!
    const msgs = result.messages.filter((m) => m.conversationId === conv.id)
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant'])  // 'human' → 'user'
    expect(msgs[1]!.content).toContain('@custom-variant dark')
  })

  it('parses ISO timestamps to milliseconds', () => {
    const result = parseClaudeExport(sample)
    const conv = result.conversations.find((c) => c.title === 'Tailwind dark mode setup')!
    // 2025-08-15T09:05:00Z = 1755247500000
    expect(conv.platformUpdatedAt).toBe(Date.parse('2025-08-15T09:05:00Z'))
  })

  it('produces Conversation with claude platform and URL', () => {
    const result = parseClaudeExport(sample)
    const conv = result.conversations[0]!
    expect(conv.platform).toBe('claude')
    expect(conv.url).toMatch(/^https:\/\/claude\.ai\/chat\//)
  })

  it('populates preview from first user + last assistant', () => {
    const result = parseClaudeExport(sample)
    const conv = result.conversations.find((c) => c.title === 'Recipe ideas')!
    expect(conv.preview?.firstUserMessage).toBe('Three vegetarian dinner ideas?')
    expect(conv.preview?.lastAssistantMessage).toMatch(/^1\. Roasted/)
  })

  it('returns empty arrays for empty input', () => {
    expect(parseClaudeExport([])).toEqual({ conversations: [], messages: [] })
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement parser**

```ts
// lib/zip-import/claude.ts
import type { Conversation, Message } from '../schema'

interface RawClaudeMessage {
  uuid: string
  text: string
  sender: 'human' | 'assistant' | string
  created_at: string  // ISO 8601
}

interface RawClaudeConv {
  uuid: string
  name: string
  created_at: string
  updated_at: string
  chat_messages: RawClaudeMessage[]
}

export function parseClaudeExport(
  raw: RawClaudeConv[],
): { conversations: Conversation[]; messages: Message[] } {
  const now = Date.now()
  const conversations: Conversation[] = []
  const messages: Message[] = []

  for (const c of raw) {
    const convId = c.uuid
    const msgs = (c.chat_messages ?? []).map((m) => normalizeMessage(convId, m))

    const firstUser = msgs.find((m) => m.role === 'user')?.content
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')?.content

    conversations.push({
      id: convId,
      platform: 'claude',
      url: `https://claude.ai/chat/${convId}`,
      title: c.name,
      tags: [],
      starred: false,
      capturedAt: now,
      platformUpdatedAt: Date.parse(c.updated_at),
      messageCount: msgs.length,
      preview: {
        ...(firstUser !== undefined ? { firstUserMessage: truncate(firstUser, 200) } : {}),
        ...(lastAssistant !== undefined ? { lastAssistantMessage: truncate(lastAssistant, 200) } : {}),
      },
    })

    messages.push(...msgs)
  }
  return { conversations, messages }
}

function normalizeMessage(convId: string, m: RawClaudeMessage): Message {
  return {
    id: `${convId}:${m.uuid}`,
    conversationId: convId,
    role: m.sender === 'human' ? 'user' : m.sender === 'assistant' ? 'assistant' : 'system',
    content: m.text ?? '',
    timestamp: Date.parse(m.created_at),
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(zip): Claude export parser"
```

---

### Task 4: ZIP dispatcher (TDD)

**Files:**
- Create: `lib/zip-import/index.ts`
- Create: `tests/lib/zip-import/index.test.ts`

- [ ] **Step 1: Install JSZip**

```bash
pnpm add jszip
```

- [ ] **Step 2: Write tests**

```ts
// tests/lib/zip-import/index.test.ts
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { importFromZipBuffer, detectVendor } from '@/lib/zip-import'
import chatgptSample from '../../fixtures/chatgpt-export-sample.json'
import claudeSample from '../../fixtures/claude-export-sample.json'

async function makeChatGPTZip(): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('conversations.json', JSON.stringify(chatgptSample))
  zip.file('chat.html', '<html></html>')  // OpenAI exports include this
  zip.file('user.json', '{"id": "user-x"}')
  return zip.generateAsync({ type: 'arraybuffer' })
}

async function makeClaudeZip(): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('conversations.json', JSON.stringify(claudeSample))
  zip.file('users.json', '[]')  // Anthropic shape
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('detectVendor', () => {
  it('identifies ChatGPT by mapping-tree shape', () => {
    expect(detectVendor(chatgptSample)).toBe('chatgpt')
  })
  it('identifies Claude by chat_messages array', () => {
    expect(detectVendor(claudeSample)).toBe('claude')
  })
  it('returns null on unknown shape', () => {
    expect(detectVendor([{ foo: 'bar' }])).toBeNull()
  })
})

describe('importFromZipBuffer', () => {
  it('parses a ChatGPT export end-to-end', async () => {
    const buf = await makeChatGPTZip()
    const result = await importFromZipBuffer(buf)
    expect(result.vendor).toBe('chatgpt')
    expect(result.conversations.length).toBeGreaterThan(0)
    expect(result.messages.length).toBeGreaterThan(0)
  })

  it('parses a Claude export end-to-end', async () => {
    const buf = await makeClaudeZip()
    const result = await importFromZipBuffer(buf)
    expect(result.vendor).toBe('claude')
    expect(result.conversations.length).toBeGreaterThan(0)
  })

  it('throws a typed error if conversations.json is missing', async () => {
    const zip = new JSZip()
    zip.file('something-else.json', '[]')
    const buf = await zip.generateAsync({ type: 'arraybuffer' })
    await expect(importFromZipBuffer(buf)).rejects.toThrow(/conversations\.json/)
  })

  it('throws a typed error if vendor cannot be detected', async () => {
    const zip = new JSZip()
    zip.file('conversations.json', JSON.stringify([{ foo: 'bar' }]))
    const buf = await zip.generateAsync({ type: 'arraybuffer' })
    await expect(importFromZipBuffer(buf)).rejects.toThrow(/vendor/i)
  })
})
```

- [ ] **Step 3: Implement dispatcher**

```ts
// lib/zip-import/index.ts
import JSZip from 'jszip'
import type { Conversation, Message } from '../schema'
import { parseChatGPTExport } from './chatgpt'
import { parseClaudeExport } from './claude'

export type Vendor = 'chatgpt' | 'claude'

export interface ImportResult {
  vendor: Vendor
  conversations: Conversation[]
  messages: Message[]
}

export class ZipImportError extends Error {
  constructor(public readonly code: 'no-conversations-json' | 'unknown-vendor' | 'parse-error', message: string) {
    super(message)
    this.name = 'ZipImportError'
  }
}

export function detectVendor(parsed: unknown): Vendor | null {
  if (!Array.isArray(parsed) || parsed.length === 0) return null
  const first = parsed[0]
  if (!first || typeof first !== 'object') return null
  // ChatGPT has `mapping` (tree of message nodes)
  if ('mapping' in first && typeof (first as Record<string, unknown>).mapping === 'object') return 'chatgpt'
  // Claude has `chat_messages` (linear array) + `uuid`
  if ('chat_messages' in first && 'uuid' in first) return 'claude'
  return null
}

export async function importFromZipBuffer(buf: ArrayBuffer): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(buf)
  const file = zip.file('conversations.json')
  if (!file) throw new ZipImportError('no-conversations-json', 'No conversations.json found in archive')

  const text = await file.async('string')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new ZipImportError('parse-error', `Invalid JSON in conversations.json: ${(e as Error).message}`)
  }

  const vendor = detectVendor(parsed)
  if (!vendor) throw new ZipImportError('unknown-vendor', 'Could not detect vendor from conversations.json shape')

  if (vendor === 'chatgpt') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = parseChatGPTExport(parsed as any)
    return { vendor, ...r }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = parseClaudeExport(parsed as any)
  return { vendor, ...r }
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(zip): JSZip-based dispatcher with vendor auto-detection"
```

---

### Task 5: Store action `importFromZip` (TDD)

**Files:**
- Modify: `stores/app-store.ts` — add `importFromZip`, `importing` flag, also extend `load()` to load conversations
- Modify: `lib/db.ts` — add `bulkPutConversations`, `bulkPutMessages` (single-transaction bulk)
- Create: `tests/stores/app-store-import.test.ts`

- [ ] **Step 1: Extend `lib/db.ts` with bulk helpers**

```ts
// lib/db.ts additions

export async function bulkPutConversations(rows: Conversation[]): Promise<void> {
  if (rows.length === 0) return
  const db = await openDb()
  const tx = db.transaction('conversations', 'readwrite')
  await Promise.all([...rows.map((r) => tx.store.put(r)), tx.done])
}

export async function bulkPutMessages(rows: Message[]): Promise<void> {
  if (rows.length === 0) return
  const db = await openDb()
  const tx = db.transaction('messages', 'readwrite')
  await Promise.all([...rows.map((r) => tx.store.put(r)), tx.done])
}
```

Add tests for these in `tests/lib/db.test.ts` (insert 100 rows, all readable; transaction failure rolls back).

- [ ] **Step 2: Write store tests**

```ts
// tests/stores/app-store-import.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import JSZip from 'jszip'
import { useAppStore } from '@/stores/app-store'
import chatgptSample from '../fixtures/chatgpt-export-sample.json'

beforeEach(async () => {
  const { __resetForTest } = await import('@/lib/db')
  await __resetForTest()
  await indexedDB.deleteDatabase('spacemind')
  useAppStore.setState({ loaded: false, spaces: [], conversations: [], toasts: [], importing: false })
})

describe('app-store.importFromZip', () => {
  it('imports conversations and messages from a ChatGPT zip', async () => {
    const zip = new JSZip()
    zip.file('conversations.json', JSON.stringify(chatgptSample))
    const buf = await zip.generateAsync({ type: 'arraybuffer' })

    await useAppStore.getState().load()
    const summary = await useAppStore.getState().importFromZip(buf)

    expect(summary.vendor).toBe('chatgpt')
    expect(summary.conversationsAdded).toBe(2)
    expect(summary.messagesAdded).toBeGreaterThan(0)
    expect(useAppStore.getState().conversations.length).toBe(2)
  })

  it('sets importing=true during import and back to false after', async () => {
    // wire async, observe via subscriber
    // ... straightforward
  })

  it('upserts on re-import: existing conversations get message updates, user metadata preserved', async () => {
    // import once, manually set spaceId on a conversation, re-import, verify spaceId survived
  })
})
```

- [ ] **Step 3: Implement importFromZip in the store**

```ts
// stores/app-store.ts additions

import { importFromZipBuffer, type ImportResult } from '@/lib/zip-import'
import { bulkPutConversations, bulkPutMessages, allConversations, getConversation } from '@/lib/db'

interface State {
  // ...existing fields
  conversations: Conversation[]
  importing: boolean
  importFromZip: (buf: ArrayBuffer) => Promise<{
    vendor: 'chatgpt' | 'claude'
    conversationsAdded: number
    messagesAdded: number
    conversationsUpdated: number
  }>
}

// in the store factory:
importFromZip: async (buf) => {
  set({ importing: true })
  try {
    const result = await importFromZipBuffer(buf)
    // Upsert with user-metadata preservation:
    let added = 0
    let updated = 0
    const merged: Conversation[] = []
    for (const incoming of result.conversations) {
      const existing = await getConversation(incoming.id)
      if (existing) {
        // Keep user-set fields, refresh platform/preview fields
        merged.push({
          ...incoming,
          spaceId: existing.spaceId,
          tags: existing.tags,
          starred: existing.starred,
          note: existing.note,
          capturedAt: existing.capturedAt,
        })
        updated++
      } else {
        merged.push(incoming)
        added++
      }
    }
    await bulkPutConversations(merged)
    await bulkPutMessages(result.messages)

    set({
      conversations: await allConversations(),
      importing: false,
    })

    get().pushToast(
      'info',
      `Imported ${added} new, updated ${updated} from ${result.vendor}`,
    )

    return {
      vendor: result.vendor,
      conversationsAdded: added,
      messagesAdded: result.messages.length,
      conversationsUpdated: updated,
    }
  } catch (e) {
    set({ importing: false })
    get().pushToast('error', (e as Error).message)
    throw e
  }
},
```

Also extend `load()` to populate `conversations`:
```ts
load: async () => {
  const [spaces, conversations] = await Promise.all([allSpaces(), allConversations()])
  set({ loaded: true, spaces: sortedForDisplay(spaces), conversations })
}
```

- [ ] **Step 4: Run all tests — green**

```bash
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(store): importFromZip with bulk insert + user-metadata-preserving upsert"
```

---

### Task 6: FlexSearch index (TDD)

**Files:**
- Create: `lib/search.ts`
- Create: `tests/lib/search.test.ts`

- [ ] **Step 1: Install FlexSearch**

```bash
pnpm add flexsearch
pnpm add -D @types/flexsearch
```

- [ ] **Step 2: Write tests**

```ts
// tests/lib/search.test.ts
import { describe, it, expect } from 'vitest'
import { createSearchIndex } from '@/lib/search'
import type { Conversation, Message } from '@/lib/schema'

const convs: Conversation[] = [
  {
    id: 'c1', platform: 'chatgpt', url: 'https://chatgpt.com/c/c1',
    title: 'Centering a div', tags: [], starred: false, capturedAt: 0,
    preview: { firstUserMessage: 'how do I center a div?' },
  },
  {
    id: 'c2', platform: 'claude', url: 'https://claude.ai/chat/c2',
    title: 'Tailwind dark mode', tags: [], starred: false, capturedAt: 0,
  },
]

const msgs: Message[] = [
  { id: 'c1:m1', conversationId: 'c1', role: 'user', content: 'how do I center a div?', timestamp: 0 },
  { id: 'c1:m2', conversationId: 'c1', role: 'assistant', content: 'use flexbox with justify-content', timestamp: 0 },
  { id: 'c2:m1', conversationId: 'c2', role: 'assistant', content: 'use @custom-variant dark in tailwind v4', timestamp: 0 },
]

describe('createSearchIndex', () => {
  it('returns conversation hits matching the title', () => {
    const idx = createSearchIndex({ conversations: convs, messages: msgs })
    const hits = idx.query('tailwind')
    expect(hits.map((h) => h.conversationId)).toContain('c2')
  })

  it('returns conversation hits matching message content', () => {
    const idx = createSearchIndex({ conversations: convs, messages: msgs })
    const hits = idx.query('flexbox')
    expect(hits.map((h) => h.conversationId)).toContain('c1')
  })

  it('deduplicates a single conversation across multiple matching messages', () => {
    const idx = createSearchIndex({ conversations: convs, messages: msgs })
    const hits = idx.query('div')
    const ids = hits.map((h) => h.conversationId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('returns empty array for no match', () => {
    const idx = createSearchIndex({ conversations: convs, messages: msgs })
    expect(idx.query('xyzxyz')).toEqual([])
  })
})
```

- [ ] **Step 3: Implement**

```ts
// lib/search.ts
import FlexSearch from 'flexsearch'
import type { Conversation, Message } from './schema'

export interface SearchHit {
  conversationId: string
  matchedIn: 'title' | 'preview' | 'message'
  score: number  // rough relevance; FlexSearch returns ordered, we just preserve order
}

export interface SearchIndex {
  query: (text: string) => SearchHit[]
}

export function createSearchIndex(input: {
  conversations: Conversation[]
  messages: Message[]
}): SearchIndex {
  const titleIdx = new FlexSearch.Index({ tokenize: 'forward', cache: true })
  const messageIdx = new FlexSearch.Index({ tokenize: 'forward', cache: true })

  const convIdToTitleKey = new Map<string, number>()
  input.conversations.forEach((c, i) => {
    const key = i
    const text = [c.title, c.preview?.firstUserMessage ?? '', c.preview?.lastAssistantMessage ?? '']
      .filter(Boolean).join(' \n ')
    titleIdx.add(key, text)
    convIdToTitleKey.set(c.id, key)
  })

  const messageKeyToConvId = new Map<number, string>()
  input.messages.forEach((m, i) => {
    const key = i
    messageIdx.add(key, m.content)
    messageKeyToConvId.set(key, m.conversationId)
  })

  return {
    query(text) {
      if (text.trim().length === 0) return []

      const titleHits = titleIdx.search(text, { limit: 50 }) as number[]
      const messageHits = messageIdx.search(text, { limit: 200 }) as number[]

      const seen = new Set<string>()
      const out: SearchHit[] = []

      const reverseTitle = new Map<number, string>()
      for (const [convId, key] of convIdToTitleKey.entries()) reverseTitle.set(key, convId)

      let score = 100
      for (const k of titleHits) {
        const convId = reverseTitle.get(k)
        if (convId && !seen.has(convId)) {
          out.push({ conversationId: convId, matchedIn: 'title', score: score-- })
          seen.add(convId)
        }
      }
      for (const k of messageHits) {
        const convId = messageKeyToConvId.get(k)
        if (convId && !seen.has(convId)) {
          out.push({ conversationId: convId, matchedIn: 'message', score: score-- })
          seen.add(convId)
        }
      }
      return out
    },
  }
}
```

- [ ] **Step 4: Run tests — green**

- [ ] **Step 5: Wire into store**

Add a `search` action to the store that rebuilds the index from current state on demand (cached behind a `useMemo`-like check). v1 simplicity: rebuild on every import.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(search): FlexSearch index over titles + previews + message content"
```

---

### Task 7: Onboarding UI

**Files:**
- Create: `components/onboarding-dialog.tsx`
- Create: `components/import-progress.tsx`
- Modify: `entrypoints/manager/App.tsx`

- [ ] **Step 1: OnboardingDialog**

Renders when `spaces.length === 0 && conversations.length === 0`. Replaces the current EmptyState (or runs alongside as the "Step 1: Import" prompt).

Visual:
- Welcome heading
- Two cards side by side: "ChatGPT" with screenshot of where to find Export Data, and "Claude" with same
- A drop zone (or file picker) accepting `.zip`
- On drop: call `useAppStore.getState().importFromZip(buf)`
- During import: show ImportProgress
- After import: show summary + button "Continue to manager"

- [ ] **Step 2: ImportProgress**

Show indeterminate spinner while `useAppStore((s) => s.importing)` is true.

- [ ] **Step 3: Wire into App.tsx**

```tsx
import { OnboardingDialog } from '@/components/onboarding-dialog'

if (spaces.length === 0 && conversations.length === 0) {
  return <OnboardingDialog />
}
```

The original "Create your first space" CTA stays available as a Skip option for users who don't want to import.

- [ ] **Step 4: Manual verify**

Build, load unpacked, drop the test fixture ZIPs. Confirm conversations appear after import.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(manager): onboarding dialog with ZIP drop import"
```

---

### Task 8: Phase 2 wrap-up

- [ ] **Step 1: Full regression**

```bash
pnpm compile
pnpm test
pnpm build
```

- [ ] **Step 2: Push + tag**

```bash
git push origin main
git tag -a phase-2-done -m "Phase 2 complete: ZIP import + FlexSearch + onboarding UI"
git push origin phase-2-done
```

---

## Phase 2 done criteria

- [ ] Two parsers (chatgpt + claude) with comprehensive tests
- [ ] JSZip-based dispatcher with vendor auto-detection
- [ ] Store action `importFromZip` with user-metadata-preserving upsert
- [ ] FlexSearch index with conversation-level result dedup
- [ ] Onboarding UI with drag/drop ZIP
- [ ] `pnpm test` all green (estimated 110+ tests total)
- [ ] Build clean, pushed, `phase-2-done` tag on remote
- [ ] Manual verify: dropping the test fixture ZIPs populates conversations and search returns hits

---

## Open questions to resolve during implementation

1. **OpenAI exports may include images / code blocks as separate parts**. v1 strips to text only. Verify with a real export later if needed.
2. **Anthropic exports may include attachments / files_v2**. Same approach.
3. **FlexSearch worker mode**: for very large indexes, FlexSearch supports workers. v1 stays single-threaded; revisit if import of 5,000+ conversations causes UI freeze.
4. **Re-import upsert semantics**: the plan preserves user fields (spaceId, tags, starred, note). Confirm with real-world re-imports that no other field needs preserving.
