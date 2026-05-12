# SpaceMind Phase 4 — Full Manager UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare list-of-strings manager with a proper UI: full Space cards (CRUD + visual operations), conversations grouped by space, multi-select + bulk move/delete, cross-space search, toast notifications, command palette (⌘K), and theme toggle. Port heavily from SpaceTab where the shape matches; adapt for conversation data where it doesn't.

**Architecture:** Same Zustand + IndexedDB + React 18 + Tailwind v4 stack. Add components mirroring SpaceTab's pattern. The data model adapter is "conversations replace tabs" — a space contains conversation references, not URL+title tab objects.

**Reference codebase:** `/Users/yaming/Documents/chrome/spacetab/` — port these as starting points:
- `components/space-item.tsx` → `components/space-card.tsx` (rename to avoid name collision concerns; SpaceMind's data is conversations not tabs)
- `components/space-list.tsx` → `components/space-list.tsx`
- `components/space-tab-row.tsx` → `components/conversation-row.tsx`
- `components/command-palette.tsx`, `components/help-dialog.tsx`, `components/toast-stack.tsx` → port mostly verbatim
- `lib/commands.ts`, `lib/i18n.ts` (just en + zh-CN for v1), `lib/ui-utils.ts` (palette + relativeTime)

---

## Phase 4 file additions / changes

```
spacemind/
  lib/
    commands.ts                  Port from spacetab — filter + group
    i18n.ts                      Stub from Phase 1 → real dictionary (en + zh-CN only)
    ui-utils.ts                  Augment with relativeTime, full per-space palette
  components/
    space-card.tsx               Big card UI (expand/collapse + CRUD buttons + conversation list inside)
    space-list.tsx               Container that maps spaces → cards, handles drag-reorder
    conversation-row.tsx         Single conversation line (favicon-ish indicator + title + host + buttons)
    command-palette.tsx          ⌘K overlay
    help-dialog.tsx              "How to use" modal
    toast-stack.tsx              Render store.toasts at bottom-right
    search-bar.tsx               Top search input wired to FlexSearch
    theme-toggle.tsx             Cycle system/light/dark
  stores/
    app-store.ts                 Extend with: setEmoji, setNote, togglePin, reorder, search,
                                 multi-select state, bulk operations
  entrypoints/
    manager/App.tsx              Major rewrite — proper two-column layout
  tests/                         Add tests for new store actions and pure logic in lib/
```

---

### Task 1: Port `lib/ui-utils.ts` + extend i18n stub

**Files:**
- Modify: `lib/ui-utils.ts` — add `relativeTime` + the full 6-palette object (colorForSpace deterministically picks from a Space.id hash, matching SpaceTab)
- Modify: `lib/i18n.ts` — start a real dictionary (en + zh-CN). Move all UI strings used in Phase 4 components into it.

- [ ] **Step 1: Port ui-utils.ts from spacetab**

Copy from `/Users/yaming/Documents/chrome/spacetab/lib/ui-utils.ts`. The SpacePalette interface + 6 keyed palettes + colorForSpace + relativeTime are reusable as-is. Adjust if spacemind needs different tones — but the 6-color palette family stays the same.

- [ ] **Step 2: Real i18n dictionary**

Replace the empty `lib/i18n.ts` stub with a real two-language dictionary covering all UI strings needed for the upcoming components. Start with about 50 keys; extend per-task as needed.

Pattern (mirror spacetab's structure):
```ts
const DICT = {
  en: { 'app.title': 'SpaceMind', 'space.rename': 'Rename', ... },
  'zh-CN': { 'app.title': 'SpaceMind', 'space.rename': '重命名', ... },
}

export function useT(): { t: (key: string, vars?: Record<string, string|number>) => string; lang: Lang; setLang: (l: Lang) => void }
```

Use chrome.storage.local for persisting language pref (mirror theme.ts pattern).

- [ ] **Step 3: Build + test (no regression)**

```bash
pnpm compile
pnpm test
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(lib): port ui-utils palette + real en/zh-CN i18n dictionary"
```

---

### Task 2: Store extensions for space CRUD + multi-select (TDD)

Extend `stores/app-store.ts`:
- `setEmoji(id, emoji)`, `setNote(id, note)`, `togglePin(id)`, `setSortIndex(id, n)` — same optimistic+rollback pattern as existing
- `moveConversationToSpace(conversationId, spaceId | null)` — null = unsorted
- `moveConversationsToSpace(ids[], spaceId | null)` — bulk
- `removeConversations(ids[])` — bulk delete
- Selection state: `selectedConvIds: Set<string>`, `selectConv(id, mode: 'toggle' | 'range' | 'replace')`, `clearSelection()`
- Search: `searchQuery: string`, `setSearchQuery(q)`, plus a derived `filteredConversations` getter (use a memoized selector or compute on demand inside components)

**Files:**
- Modify: `stores/app-store.ts`
- Modify: `tests/stores/app-store.test.ts` — add tests for new actions

- [ ] **Step 1: Write tests for each new action (TDD)**
  - setEmoji clears when given undefined
  - togglePin flips
  - moveConversationsToSpace updates all the IDs
  - removeConversations removes from state + IDB
  - selectConv 'toggle' / 'range' / 'replace' produce the right set
  - clearSelection empties

- [ ] **Step 2: Implement actions**

For multi-select with 'range', the store needs to know the visible conversation order to compute the range. Pass it through the action arg: `selectConv(id, mode, visibleIds?: string[])`. That keeps store pure.

- [ ] **Step 3: Verify all tests pass**
- [ ] **Step 4: Commit**

```bash
git commit -am "feat(store): emoji/note/pin/move/bulk-remove + multi-select state"
```

---

### Task 3: `conversation-row.tsx` (single row UI)

**File:**
- Create: `components/conversation-row.tsx`

Props:
```ts
{
  conversation: Conversation
  selected: boolean
  selectedCount: number  // for the multi-drag badge later
  onClick: (e: React.MouseEvent) => void   // toggle / range / open depending on modifiers
  onOpenInNewTab: () => void               // explicit "open the original" button
  onMove: (spaceId: string | null) => void
  onRemove: () => void
  availableSpaces: Space[]
}
```

Visual (port from spacetab/components/space-tab-row.tsx):
- Left: small platform indicator (chatgpt vs claude — colored dot + text)
- Middle: title (truncate); below the title, dim preview text if available
- Right: hover-revealed buttons → Open external, Move to space (dropdown), Remove
- Click row: open original URL in new tab (handle modifier keys: ⌘/Ctrl+click toggles select, Shift+click range, plain click opens)
- Selected state visual: ring + slight background tint

- [ ] **Step 1: Implement the component**
- [ ] **Step 2: Manual verify visually (open the rendered manager, eyeball)**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ui): conversation-row component with hover actions + modifier-click selection"
```

---

### Task 4: `space-card.tsx` (the big card)

**File:**
- Create: `components/space-card.tsx`

This is the biggest single component. Port from `/Users/yaming/Documents/chrome/spacetab/components/space-item.tsx` but adapt for conversations.

Features (port all):
- Header: emoji/dot + name + count badge + hover-revealed action buttons + Switch-equivalent removed (no "switch" concept in SpaceMind; replaced by "Open all in this space" maybe? defer for now)
- Inline rename
- Buttons: pin (star), emoji edit (prompt), note edit (prompt), duplicate, delete, **collapse**
- Per-space color palette (from `colorForSpace(space.id)` in ui-utils)
- Note shown italic below header when set
- Drop zones for drag actions (Phase 4 includes basic drag/drop for moving conversations into spaces — Phase 4b will add space-card reordering if time permits; defer if it adds too much scope)
- When expanded: list of conversations belonging to this space using `conversation-row`

Multi-select bar appears above the conversation list when any rows are selected: "X selected · Open all · Move to… · Remove · Cancel" — same pattern as SpaceTab.

- [ ] **Step 1: Implement**
- [ ] **Step 2: Hook into App.tsx (replace the current bare list)**
- [ ] **Step 3: Verify visually**
- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): space-card component with full CRUD + collapsed conversations"
```

---

### Task 5: `search-bar.tsx` + wire FlexSearch

**Files:**
- Create: `components/search-bar.tsx`
- Modify: `stores/app-store.ts` — add `searchQuery` + `searchIndexVersion` (rebuild cache key)
- Modify: `entrypoints/manager/App.tsx` — when searchQuery non-empty, show flat result list instead of per-space cards

UX:
- Top bar input
- Debounced (200ms) — calls `createSearchIndex(...).query(q)` from `lib/search.ts`
- Results: flat list of conversation hits sorted by match relevance, grouped by space (show space badge next to each)
- "x results in N spaces · clear" line below

For v1 simplicity: rebuild the index on every search query change (FlexSearch is fast). v2 can cache + invalidate on import.

- [ ] **Step 1: Component + wire**
- [ ] **Step 2: Verify (import a ZIP, type a search term, see results)**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat(ui): cross-space search bar wired to FlexSearch"
```

---

### Task 6: `toast-stack.tsx` (render the toasts)

**File:**
- Create: `components/toast-stack.tsx`

The store pushes toasts already; until now they're invisible. Port from spacetab — a fixed-position bottom-right stack with auto-dismiss handled by the store's setTimeout.

- [ ] **Step 1: Implement (verbatim port from spacetab)**
- [ ] **Step 2: Mount in App.tsx**
- [ ] **Step 3: Verify (trigger an import, see "Imported X new" toast)**
- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ui): toast-stack renders store-managed notifications"
```

---

### Task 7: Command palette (⌘K) + theme toggle

**Files:**
- Create: `lib/commands.ts` (port from spacetab — filter + group)
- Create: `components/command-palette.tsx` (port from spacetab)
- Create: `components/theme-toggle.tsx`
- Modify: `entrypoints/manager/App.tsx` — global ⌘K listener, mount palette + theme toggle

Commands for SpaceMind v1:
- "Open help"
- "Toggle theme" (cycles system → light → dark → system)
- "Export JSON" (SpaceMind's own data — separate from platform ZIP imports)
- "Import JSON" (SpaceMind's own data)
- "Import ZIP" (platform exports — opens file picker)
- "Show: <space-name>" for each space (scrolls to / focuses card)
- Search and execute

Skip from spacetab: "Smart archive", "Switch to space" (not applicable to SpaceMind), "Discard all" (no live tabs concept). New ones above replace them.

- [ ] **Step 1: lib/commands.ts**
- [ ] **Step 2: command-palette.tsx + mount in App.tsx**
- [ ] **Step 3: theme-toggle.tsx (small icon button in top-right)**
- [ ] **Step 4: Manual verify ⌘K opens palette, theme cycle works**
- [ ] **Step 5: Commit**

```bash
git commit -am "feat(ui): command palette ⌘K + theme toggle"
```

---

### Task 8: Help dialog + SpaceMind JSON export/import (lib + store + dialog)

**Files:**
- Create: `lib/export-import.ts` (SpaceMind-specific — not the ChatGPT/Claude ZIPs). Schema: a JSON file with `{ format: 'spacemind-export', formatVersion: 1, spaces, conversations, messages, exportedAt }`. Mirror spacetab's pattern.
- Create: `components/help-dialog.tsx` (port from spacetab — but with SpaceMind-specific text)
- Modify: `stores/app-store.ts` — `exportToJson()`, `importFromJson(file)` actions

- [ ] **Step 1: lib/export-import.ts with Zod schema**
- [ ] **Step 2: Help dialog**
- [ ] **Step 3: Wire into command palette**
- [ ] **Step 4: Commit**

```bash
git commit -am "feat(io): JSON export/import + help dialog"
```

---

### Task 9: Phase 4 wrap-up

- [ ] **Step 1: Full regression**

```bash
pnpm compile
pnpm test
pnpm build
```

Expected: ~145-160 tests total (132 from P3 + ~15 from store extensions + ~5 from export-import).

- [ ] **Step 2: Push main + tag**

```bash
git push origin main
git tag -a phase-4-done -m "Phase 4 complete: full manager UI — space cards, conversations, search, command palette, help."
git push origin phase-4-done
```

- [ ] **Step 3: Manual e2e checklist for the user**
  - Create / rename / delete a space → UI updates, persists
  - Import a ZIP → conversations appear inside the right space card
  - Multi-select conversations (⌘/Ctrl+click, Shift+click) → bulk-move to another space
  - Search "tailwind" → cross-space hits shown
  - ⌘K → palette opens; type "theme" → toggle works
  - Toast appears after each import / move
  - Help dialog reads correctly

---

## Phase 4 done criteria

- [ ] Space card UI with CRUD operations
- [ ] Conversations rendered inside space cards
- [ ] Multi-select + bulk move/delete
- [ ] Cross-space FlexSearch search bar
- [ ] Toast stack visible
- [ ] Command palette (⌘K)
- [ ] Theme toggle
- [ ] Help dialog
- [ ] SpaceMind JSON export/import
- [ ] All tests still green
- [ ] Build clean, pushed, `phase-4-done` tag on remote

After Phase 4, the extension is feature-complete for v1 publishable to Chrome Web Store as **SpaceMind v1.0** with a similar submission flow as SpaceTab.

---

## Out of scope for Phase 4 (deferred to v1.1)

- E2E sync (Pro tier)
- Per-conversation note rich text editing
- Drag-and-drop reorder of space cards themselves (only conversation drag-to-space in v1)
- "Open all conversations in this space" bulk action (would re-open many tabs — useful but easy to defer)
- Keyboard navigation in conversation lists (j/k arrows etc — nice-to-have)
- Smart auto-archive (AI suggests which space — v2 / BYOK)

---

## Risks / mitigations

1. **Component port size** — space-item.tsx in spacetab is 700+ lines. Direct port risks bringing tab-specific UI we don't need. Strategy: read spacetab's version, adapt as you write spacemind's version, don't blindly copy.

2. **Drag-and-drop complexity** — spacetab uses native HTML5 drag/drop with three drop targets (cross-space tab, live tab, space merge). SpaceMind only needs one (conversation → space). Simpler. Defer space-to-space merge.

3. **Bundle size** — Phase 4 adds many components. Run `pnpm build` after every task; if any chunk grows past 400KB, investigate before committing.

4. **i18n drift** — adding strings as you go is easier than retrofitting. Each component should pull text via `useT()` from day one.
