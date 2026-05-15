# SpaceMind v1.0 — E2E Manual Test Checklist

Run this against a fresh build (`pnpm build` → load unpacked in Chrome).
Tick each item that passes; note any bugs as a sub-bullet for follow-up commits.

---

## Install & Empty State

- [ ] Load unpacked from `.output/chrome-mv3/`
- [ ] Click toolbar icon → manager opens in a new tab
- [ ] Empty state: "Welcome to SpaceMind" + onboarding dialog visible
- [ ] Skip onboarding (or click "Create your first space") → manager moves past welcome

## Import & Storage

- [ ] Click `Import ZIP` in manager header → file picker opens
- [ ] Select test fixture `~/Downloads/sm-chatgpt.zip` (or your real ChatGPT export)
- [ ] Toast confirms "Imported N from chatgpt"
- [ ] Conversations appear in "Unsorted" section
- [ ] Reload the tab → conversations persist (IndexedDB working)

## Space CRUD

- [ ] `+ New space` button → creates a card with default name
- [ ] Hover space card → action buttons appear (rename / emoji / note / pin / duplicate / delete)
- [ ] Rename: click pencil → input shows → type → Enter saves
- [ ] Emoji: click emoji button → window.prompt → enter "🧪" → saves to header
- [ ] Pin: click star → moves to top + filled star shows
- [ ] Delete: window.confirm → space removed, its conversations go to Unsorted

## Multi-select & Bulk Ops

- [ ] Cmd+click 3 conversations → action bar shows "3 selected"
- [ ] "Move to…" popover → pick a space → all 3 move
- [ ] Cmd+click again → toggle off
- [ ] Shift+click range → multiple selected at once
- [ ] "Remove" with selected → window.confirm → all deleted

## Search

- [ ] Top search bar → type "tailwind" (or another keyword you know is in your data)
- [ ] Cross-space results show, grouped by space
- [ ] "X results in N spaces" summary visible
- [ ] Clear button → returns to space view

## Command Palette

- [ ] ⌘K (or Ctrl+K) → palette opens
- [ ] Type "theme" → "Toggle theme" command filtered → Enter → cycles theme
- [ ] Type "help" → opens help dialog
- [ ] Type "export" → JSON export downloads spacemind-YYYY-MM-DD.json
- [ ] Esc closes palette

## In-page Overlay (chatgpt.com / claude.ai)

- [ ] Open https://chatgpt.com/c/<any-real-conv-id> (must be logged in)
- [ ] Right-bottom: purple SpaceMind FAB visible
- [ ] Click FAB → overlay opens, space picker shown
- [ ] Or press ⌘+Shift+K → same overlay
- [ ] Type to filter spaces, Enter or click a space → save
- [ ] ✓ confirmation shown for 1.2s, overlay closes
- [ ] Switch back to manager tab → conversation appears in chosen space (visibilitychange triggers reload)

## Sidebar Scrape (passive)

- [ ] On chatgpt.com sidebar with conversation list visible: wait 1 sec
- [ ] Switch to SpaceMind manager → conversations from sidebar appear in Unsorted (deduplicated)
- [ ] Same flow on claude.ai

## Dark Mode

- [ ] ⌘K → Toggle theme to Dark
- [ ] All UI surfaces render legibly in dark
- [ ] Toast, dialogs, overlay all dark-aware
- [ ] Reload manager → still dark (persists)

## Localization (zh-CN)

- [ ] (Need a way to change language — currently via store internals OR command palette if exposed)
- [ ] If exposed: switch to zh-CN, verify space cards, overlay, palette, help all translate
- [ ] If not exposed: skip / note as v1.1 gap

## Robustness

- [ ] Close all tabs, open fresh ChatGPT page → FAB still appears (content script re-mounts)
- [ ] Export JSON → delete a space manually → re-import same JSON → re-creates the deleted space
- [ ] No console errors during normal use

---

## Bug log

If anything fails, write below:

- (date) — (page) — (what happened) — (severity: blocker / important / nit)
