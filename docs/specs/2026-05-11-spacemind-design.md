# SpaceMind v1 — Design Spec

**Date:** 2026-05-11
**Status:** Approved (brainstorm phase)
**Next:** Writing-plans → Implementation

---

## TL;DR

SpaceMind is a Chrome extension that organizes your cross-platform AI conversations
(ChatGPT + Claude in v1) into named project Spaces. Local-first, MIT open source.

It is **SpaceTab for AI conversations** — same authors, same brand family, same
"spaces" mental model, same local-first + open source convictions, but the unit
being organized is an AI conversation instead of a browser tab.

---

## 1. Why this product

### 1.1 Market pain

Cross-platform AI conversation management is genuinely unsolved:

- ChatGPT, Claude, Gemini sidebars are flat lists that become unusable past
  ~100 conversations. Search is title-only and weak.
- Each platform's "Projects" feature is locked inside its own walled garden;
  there is no way to see "all my conversations about Project X" across
  vendors.
- AIPRM (currently the dominant power-user tool, ~2M installs) is closed-source,
  $39/mo Pro, $79/mo Elite, and increasingly unloved. Its primary focus is
  prompt templates, not conversation management — users report after ~100
  chats they realize conversation org is the bigger pain.

### 1.2 Differentiation vs alternatives

| | AIPRM | PromptPad | Anara | ChatGPT-folder extensions | **SpaceMind** |
|---|---|---|---|---|---|
| Cross-platform conversations | Weak | Limited | Limited | No (single platform each) | **Yes (ChatGPT + Claude)** |
| Local-only data | No (cloud) | No (cloud) | No | Mixed | **Yes** |
| Open source | No | No | No | Some | **Yes (MIT)** |
| Price | $39-79/mo | $5+/mo | $9+/mo | Mostly free | **Free + optional $30 Pro sync** |
| Focus | Prompts | Prompts | Both | Conversations only | **Conversation Spaces** |

### 1.3 Brand strategy

SpaceMind is the second product in a "Space-" family with SpaceTab. They share:

- Visual design language (Linear × Notion aesthetic, color palette, dark mode)
- "Spaces" mental model
- Local-first + MIT open source ethos
- Tech stack

Future products (SpaceLab, SpaceFlow?) can extend the family. Each is
small, focused, opinionated.

---

## 2. v1 scope (what ships)

### 2.1 In scope

**Platforms supported:** ChatGPT (chatgpt.com) + Claude (claude.ai). Only these two.

**Data acquisition (hybrid):**
- ZIP import from each vendor's official export (one-time onboarding;
  user re-runs monthly to keep full-text search complete)
- Real-time sidebar scraping for new conversations (title + URL + timestamp;
  appended to "Unsorted" until user files them)

**Persistence:** IndexedDB. Three object stores:
- `spaces` — Space CRUD
- `conversations` — metadata (one row per conversation across all platforms)
- `messages` — message bodies (only populated for ZIP-imported conversations)

**Search:** FlexSearch over the `conversations` table (titles + first/last
message previews) + `messages` table (full content from ZIP imports).

**UX (dual):**
- `⌘M` floating overlay injected into ChatGPT/Claude pages → "Save current
  conversation to Space X". Minimal: Space picker + Enter. <2 second flow.
- Dedicated manager page (toolbar icon + `⌘+Shift+M`) → full app for
  organization, search, multi-select, bulk operations.

**Space operations (parity with SpaceTab):**
- Create / rename / delete / duplicate
- Emoji + note per space
- Pin to top
- Manual reorder (drag card edge: top/bottom = reorder, middle = merge)
- Color palette auto-assigned (6 colors, same as SpaceTab)

**Conversation operations:**
- Drag to space / multi-select + bulk move
- Star / unstar
- Add note (free-text per conversation)
- Tags (free-form, multi-select filter)
- Click to open original conversation in new tab

**Other:**
- Dark mode (system / light / dark) — same hook pattern as SpaceTab
- English + Simplified Chinese (other 3 languages from SpaceTab can be added v1.1)
- Command palette (⌘K) — same component as SpaceTab
- JSON export/import of all SpaceMind data (independent of platform ZIPs)

### 2.2 Out of scope for v1

Will explicitly NOT ship in v1:

- **Cross-device sync** — v1.1 Pro tier
- **Gemini, Perplexity, DeepSeek** — v1.2 (add platforms after the 2-platform
  pattern proves stable)
- **Real-time full-content scraping** — too brittle, ToS-risky, and slow.
  Stuck with ZIP imports for full content.
- **Prompt library** — adjacent product, deferred until v2 or never
- **AI-suggested space assignment** — v2; needs BYOK and adds complexity
- **Per-conversation notes auto-extracted from content** — v2
- **SpaceTab ↔ SpaceMind integration** — v2 (share a Space concept across
  both products via JSON interchange)
- **Mobile** — not planned
- **Team / sharing features** — not planned

---

## 3. User flows

### 3.1 First-time onboarding (one-time)

1. Install from Chrome Web Store
2. Manager page auto-opens with a welcome screen
3. Two-step guided onboarding:
   - **Step 1**: "Import your existing conversations" — show screenshots of
     where to find the Export button in ChatGPT and Claude settings. Provide
     direct links to the relevant settings pages.
   - **Step 2**: Drag-and-drop or file picker for the downloaded ZIP. Parser
     identifies vendor automatically (file structure differs). Progress bar
     during indexing.
4. Result: "Imported N conversations from ChatGPT" / "M from Claude".
   IndexedDB populated. User lands on the empty Spaces page with a callout
   to create their first Space.

### 3.2 Real-time archive (high-frequency moment)

User is mid-conversation in ChatGPT/Claude:

1. Hit `⌘M` (configurable). Floating overlay appears centered.
2. Overlay shows:
   - Current conversation title (read from page) and platform
   - Space picker (fuzzy-search existing spaces + "+ Create new")
   - Tag input (optional)
3. Type / select Space → Enter
4. Overlay disappears. Toast confirms "Saved to Engineering".
5. Total interaction: <2 seconds, no tab switch.

The overlay is implemented as a content script + injected Shadow DOM root
to avoid CSS bleed from the host page.

### 3.3 Find a past conversation (medium-frequency)

1. Open manager page (`⌘+Shift+M` or click toolbar icon)
2. Left rail: list of spaces (collapsible cards, SpaceTab pattern)
3. Top: global search bar
4. Type "react authentication" → results matrix:
   - Conversations whose title matches
   - Conversations whose full-content (ZIP-imported messages) matches
   - Grouped by space, sorted by relevance
5. Click a result → opens the original ChatGPT/Claude page in a new tab
6. Optional: hover preview shows first/last message snippets in-app

### 3.4 Periodic ZIP re-import (low-frequency, ~monthly)

1. Manager page → Settings → "Refresh from ZIP"
2. Same drop interface as onboarding
3. Diff: new conversations get imported, existing get message-body updates,
   nothing is deleted
4. Toast: "Imported 14 new + updated 3 existing conversations"

---

## 4. Data model

```ts
// All persisted in IndexedDB. No chrome.storage usage for application data.

interface Space {
  id: string             // UUID
  name: string
  emoji?: string         // user-set
  note?: string          // free text
  color: PaletteKey      // 'indigo' | 'emerald' | 'amber' | 'pink' | 'violet' | 'cyan'
  pinned?: boolean
  sortIndex?: number
  createdAt: number      // epoch ms
  updatedAt: number
}

interface Conversation {
  id: string             // platform-native: ChatGPT URL slug or Claude conversation id
  platform: 'chatgpt' | 'claude'
  url: string            // canonical link back to original conversation
  title: string
  spaceId?: string       // null = unsorted bucket
  tags: string[]
  starred: boolean
  note?: string          // user free-text per conversation
  capturedAt: number     // when SpaceMind first saw it
  platformUpdatedAt?: number  // last activity per platform, from ZIP if available
  messageCount?: number  // populated after ZIP import; otherwise null
  preview?: {
    firstUserMessage?: string  // truncated to ~200 chars
    lastAssistantMessage?: string
  }
}

interface Message {
  id: string             // platform-native or composite
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string        // markdown source
  timestamp: number
  // attachments, tool calls, etc. — captured raw but not indexed in v1
}

interface AppSettings {
  theme: 'system' | 'light' | 'dark'
  language: 'en' | 'zh-CN'  // v1 limit
  overlayShortcut: string   // default '⌘M'
  managerShortcut: string   // default '⌘+Shift+M'
  newtabOverride: boolean   // false in v1 (consider for v1.1)
  lastZipImports: {
    chatgpt?: number       // epoch of last import
    claude?: number
  }
}
```

Constraints:
- `Conversation.id` must be unique per `platform`. Use composite key `${platform}:${id}` in IndexedDB if needed.
- `Conversation.spaceId === null` = "Unsorted" virtual bucket (a UI concept, not a real Space row).
- Deleting a `Space` does NOT delete its conversations; they fall back to Unsorted with a toast offering Undo (10s).
- ZIP re-import is upsert: existing conversations update their messages but keep user metadata (spaceId, tags, starred, note).

---

## 5. Technical architecture

### 5.1 Stack

Same as SpaceTab — maximum reuse:

| Layer | Choice |
|---|---|
| Framework | WXT (MV3) |
| Language | TypeScript strict |
| UI | React 18 + Tailwind v4 |
| State | Zustand |
| Validation | Zod |
| Tests | Vitest + @webext-core/fake-browser |
| Persistence | **IndexedDB via idb-keyval or Dexie** (not chrome.storage — too small for thousands of messages) |
| Search | **FlexSearch** (in-memory index, persisted to IDB) |
| Package manager | pnpm |

### 5.2 Entry points

```
entrypoints/
  manager/           Full-page UI (the main surface)
  background.ts      Service worker — keeps IDB ready, hosts shortcut handlers
  content-chatgpt/   Content script for chatgpt.com — injects overlay
  content-claude/    Content script for claude.ai — injects overlay
```

The content scripts inject a Shadow DOM root and mount a React subtree for the
overlay. Communication between content script and manager via
`chrome.runtime.sendMessage` (or a shared offscreen document if state needs to
live somewhere accessible to both — TBD in plan phase).

### 5.3 lib/ layout

```
lib/
  schema.ts             Zod schemas
  db.ts                 IndexedDB wrapper (open, migrate, transactions)
  spaces.ts             Pure space domain logic (no chrome.*)
  conversations.ts      Conversation CRUD against IDB
  search.ts             FlexSearch index + query API
  zip-import/
    chatgpt.ts          Parser for OpenAI export ZIP
    claude.ts           Parser for Anthropic export ZIP
    index.ts            Vendor detection + dispatch
  sidebar-scrape/
    chatgpt.ts          DOM selectors + observers for chatgpt.com
    claude.ts           DOM selectors + observers for claude.ai
  overlay.ts            Logic for the ⌘M floating panel
  i18n.ts               5-language hook (en + zh-CN for v1, structure for more)
  theme.ts              Theme hook (system / light / dark)
  ui-utils.ts           Per-space color palette + relative time (port from SpaceTab)
  commands.ts           Command palette filtering (port from SpaceTab)
stores/
  app-store.ts          Zustand
components/             React components (cards, dialogs, palette, …)
hooks/                  React hooks
```

### 5.4 ZIP import — what each vendor gives us

OpenAI export (verified 2026-05):
- ZIP contains `conversations.json` (array) + `chat.html` (rendering)
- Each conversation has `title`, `create_time`, `update_time`, `mapping`
  (graph of messages with tree edges and content parts)
- Parser walks `mapping` to flatten to a linear message array per conversation

Anthropic export (verified 2026-05):
- ZIP contains `conversations.json` (array) — simpler structure
- Each conversation has `uuid`, `name`, `created_at`, `updated_at`,
  `chat_messages` (linear array with text + attachments)
- Parser is simpler than OpenAI's

Both: SpaceMind reads, normalizes to our `Conversation` + `Message` schemas,
inserts to IndexedDB. Bulk inserts use IDB transactions for speed.

### 5.5 Sidebar scraping — robustness strategy

- Content scripts hold per-platform CSS selectors in one place
  (`lib/sidebar-scrape/*.ts`)
- MutationObserver on the sidebar container detects new entries
- If selectors break (platform redesign): the manager page shows a banner
  "Real-time sync paused for ChatGPT — please update SpaceMind"
- We never crash the host page — all observer callbacks are wrapped in
  try/catch with silent logging

### 5.6 Privacy guarantees

- No network requests from SpaceMind code (Sentry / analytics / etc — explicitly none)
- All data in IndexedDB, scoped to user's Chrome profile, never transmitted
- Privacy policy explicit about this; same wording template as SpaceTab's PRIVACY.md
- Permissions justified individually in store submission

### 5.7 Permissions requested

| Permission | Why |
|---|---|
| `storage` | IndexedDB needs no permission; this is for `chrome.storage.local` for AppSettings only |
| `tabs` | Open conversation links in new tabs from manager page |
| Host permissions for `chatgpt.com/*` and `claude.ai/*` | Content scripts for overlay + sidebar scraping |

That's it. No `<all_urls>`, no `tabGroups`, no `cookies`, no `webRequest`.

---

## 6. Visual design

Direct port from SpaceTab:

- Color palette: same 6-color per-space assignment
- Typography: same(Inter or SF Pro)
- Card pattern: same
- Dark mode: same `@custom-variant dark` Tailwind setup
- Brand difference: SpaceTab primary = indigo/violet gradient. SpaceMind primary = **purple** (one notch warmer to differentiate but stay in family).

Logo: same hexagon/layer motif as SpaceTab but the inner glyph is a stylized
chat bubble / thought rather than stacked layers.

---

## 7. Roadmap

| Version | Scope | Target |
|---|---|---|
| **v1.0** | Above spec (ChatGPT + Claude + dual UX + ZIP import + free MIT) | 7-8 weeks |
| v1.1 | Add Gemini support; Pro tier with E2E encrypted sync ($30 one-time) | +4 weeks |
| v1.2 | Add Perplexity + DeepSeek; refresh-from-ZIP UX polish | +3 weeks |
| v2 | AI-suggested space assignment (BYOK); SpaceTab integration; per-conversation note extraction | TBD |

---

## 8. Open questions to resolve in writing-plans phase

These don't block this spec but need answering before coding:

1. **IndexedDB library** — raw `idb` vs `Dexie` vs `idb-keyval` (Dexie likely;
   benchmarks during planning)
2. **Shadow DOM CSS strategy** — Tailwind in Shadow DOM has known issues;
   may need a small CSS-in-JS escape hatch for the overlay only
3. **Service-worker keep-alive** — long imports may need an offscreen document
   to avoid MV3 SW eviction mid-import
4. **Chrome Web Store name** — verify "SpaceMind" available at submission time
   (it's free on the Chrome Web Store as of 2026-05-10 search)
5. **Onboarding ZIP UX detail** — what if user doesn't want to import? Should
   we let them skip and only use real-time sidebar scraping? (Probably yes,
   with a banner reminder)

---

## 9. Success criteria (how do we know v1 worked)

| Metric | Target by D+90 |
|---|---|
| Chrome Web Store installs | 3,000 |
| Active weekly users | 800 |
| 4+ star reviews | 30+ |
| Average # of Spaces per active user | 3-5 |
| Average # of conversations imported per active user | 50+ |
| Hacker News Show HN | Top 30 of the day |
| GitHub stars | 200 |

Not chasing: paid conversions (that's v1.1 with Pro tier), team adoption
(no team features), broad enterprise pickup (out of scope).

---

## 10. Failure modes to monitor

| Risk | Mitigation |
|---|---|
| ChatGPT/Claude DOM redesign breaks scraping | Selectors centralized in `lib/sidebar-scrape/*`; banner in manager when broken; ZIP import remains primary value |
| Users won't run ZIP export (friction too high) | If <30% of active users have run import after D+14, add an inline "skip and use real-time only" path |
| Performance with 10,000+ conversations | Benchmark FlexSearch + IDB queries during planning; consider pagination + virtual lists in manager UI |
| ToS concerns about scraping | We only read DOM the user is already seeing; no automated browsing; clear in PRIVACY.md; ZIP import is officially supported by both platforms |
| Name collision late-discovered | Re-search at Chrome Web Store submission; pre-clear with Anthropic trademark search before v1.1 |

---

End of spec.
