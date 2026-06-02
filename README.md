# SpaceMind

<!-- TODO: replace EXTENSION_ID_PLACEHOLDER after first publish -->
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/EXTENSION_ID_PLACEHOLDER?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/EXTENSION_ID_PLACEHOLDER)
[![Users](https://img.shields.io/chrome-web-store/users/EXTENSION_ID_PLACEHOLDER?label=users)](https://chromewebstore.google.com/detail/EXTENSION_ID_PLACEHOLDER)
[![Rating](https://img.shields.io/chrome-web-store/rating/EXTENSION_ID_PLACEHOLDER?label=rating)](https://chromewebstore.google.com/detail/EXTENSION_ID_PLACEHOLDER)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Project spaces for your AI conversations. Organize ChatGPT, Claude, Gemini, DeepSeek and Mistral threads into named workspaces, search across exports, save in one keystroke. **Local-first, no account, no telemetry, open source.**

[**Install on Chrome Web Store →**](https://chromewebstore.google.com/detail/EXTENSION_ID_PLACEHOLDER) · [Privacy Policy](PRIVACY.md) · [中文文档](#中文)

---

## What it does

SpaceMind organises ChatGPT, Claude, Gemini, DeepSeek and Mistral conversations into **named spaces** — one per project, research thread, or personal context. It sits between AIPRM (closed-source, paid, prompt-library focus) and ChatGPT's built-in folders (single-platform, walled garden), with cross-platform reach, full local ownership, and zero cost.

### Core features

- **Spaces** — group conversations by project. Pin favourites, add an emoji + note, reorder freely, filter by tags.
- **Cross-platform** — one inbox for ChatGPT, Claude, Gemini, DeepSeek and Mistral. A single space can hold threads from any of them.
- **ZIP import** — drop your official ChatGPT or Claude export and search every message you've ever sent, locally.
- **Real-time sidebar scraping** — visit a supported AI chat site and SpaceMind silently captures new conversations as you create them. No polling, no API.
- **⌘+Shift+K overlay** — one keystroke on a supported site opens a floating picker to file the current thread into a space.
- **Floating button** — a purple FAB on the right edge of supported sites for users who prefer a visible entry point.

### Power features

- **Multi-select** — ⌘/Ctrl+click toggles, Shift+click selects ranges. Bulk move, delete, star.
- **Cross-space search** — full-text across titles + message bodies, powered by FlexSearch.
- **Command palette (⌘K)** — every action one keystroke away.
- **Dark mode** — light / dark / follow system.
- **i18n** — English and 简体中文.
- **JSON export/import** — your data is portable, including imported message content.
- **MIT open source** — no account, no telemetry, no network calls beyond the sites you visit.

### Privacy

- **Local-only**: IndexedDB + `chrome.storage.local` in your browser profile. No servers, no analytics, no remote logging.
- **Minimal permissions**: `storage`, plus host access for `chatgpt.com`, `claude.ai`, `gemini.google.com`, `chat.deepseek.com` and `chat.mistral.ai` only (required for sidebar scraping + overlay).
- **MIT open source** — audit the code yourself.

See [PRIVACY.md](PRIVACY.md).

---

## Quick start

1. [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/EXTENSION_ID_PLACEHOLDER).
2. Click the SpaceMind toolbar icon. The manager opens in a tab.
3. Click **Import ZIP** and drop in your ChatGPT or Claude export to backfill history with full-text search.
4. Drag conversations into spaces, or shift-click a range and bulk-move.
5. On any supported AI chat site: click the purple floating button (or press `⌘+Shift+K`) to file the current thread into a space.

The first time the manager opens, an onboarding dialog walks through the basics. Reopen it any time via the **?** button.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘+Shift+K` | Toggle the overlay on supported AI chat sites |
| `⌘+click` / `Ctrl+click` | Toggle conversation selection |
| `Shift+click` | Select a range of conversations |
| `Esc` | Close dialogs / clear search |

---

## Drag and drop

Drop a conversation card onto a space card (emerald ring highlights the target) to move it into that space. That's the entire DnD surface — one ring colour, one behaviour, no merge / reorder hidden modes. Multi-select drags carry every selected conversation in one drop.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [WXT](https://wxt.dev) (Manifest V3) |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| UI | React 18 + Tailwind CSS v4 |
| State | Zustand |
| Validation | Zod |
| Storage | IndexedDB via [`idb`](https://github.com/jakearchibald/idb) |
| Search | [FlexSearch](https://github.com/nextapps-de/flexsearch) |
| ZIP parsing | [JSZip](https://stuk.github.io/jszip/) |
| Tests | Vitest + `fake-indexeddb` (221 tests) |
| Package manager | pnpm |

## Architecture

```
entrypoints/
  manager/                     Full-page UI
  background.ts                Service worker — single IDB writer
  content-chatgpt.content.ts   Scraper + overlay on chatgpt.com
  content-claude.content.ts    Scraper + overlay on claude.ai
  content-gemini.content.ts    Scraper + overlay on gemini.google.com
  content-deepseek.content.ts  Scraper + overlay on chat.deepseek.com
  content-mistral.content.ts   Scraper + overlay on chat.mistral.ai
lib/
  schema.ts / db.ts            Zod schemas + idb wrapper
  spaces.ts / search.ts        Domain logic + FlexSearch
  zip-import/ sidebar-scrape/ overlay/   Feature modules
  commands.ts export-import.ts runtime-messages.ts i18n.ts theme.ts
stores/  app-store.ts          Zustand
components/                    React components
```

Content scripts and the manager never write to IndexedDB directly — they send typed messages to the background service worker, which is the **single IDB writer**. This avoids write races and keeps schema validation in one place.

---

## Build from source

```bash
pnpm install
pnpm build       # → .output/chrome-mv3/
pnpm zip         # → .output/spacemind-X.X.X-chrome.zip
```

Other commands:

```bash
pnpm dev         # WXT dev mode with HMR
pnpm test        # vitest run
pnpm test:watch  # vitest watch
pnpm compile     # tsc --noEmit
```

Loading the unpacked build:

1. `chrome://extensions/` → toggle Developer mode
2. Load unpacked → select `.output/chrome-mv3/`

---

## Roadmap

Ideas, not commitments. Open an issue if any matter to you.

- **v1.1** — Optional Pro tier ($30 one-time) for end-to-end encrypted cross-device sync.
- **v1.2** — Add Perplexity (Gemini, DeepSeek, Mistral now supported).
- **v2.0** — BYOK AI-suggested space assignment for newly-captured conversations.
- **Future** — SpaceTab ↔ SpaceMind integration around a shared Space concept (one mental model, two surfaces).

## Contributing

Bug reports and feature requests via [GitHub issues](https://github.com/tashuo/spacemind/issues). PRs welcome — please run `pnpm test && pnpm compile` before pushing.

## License

MIT — see [LICENSE](LICENSE).

---

## 中文

把 ChatGPT、Claude、Gemini、DeepSeek、Mistral 的对话整理成命名的「项目空间」,本地搜索全部历史,一个快捷键把当前对话归档。**完全本地、无账号、零遥测、开源免费。**

[**安装 →**](https://chromewebstore.google.com/detail/EXTENSION_ID_PLACEHOLDER) · [隐私政策](PRIVACY.md)

### 它是什么

SpaceMind 处在 AIPRM(闭源 / 收费 / 偏 Prompt 库)和 ChatGPT 自带文件夹(单平台 / 封闭生态)之间 — 跨平台(ChatGPT / Claude / Gemini / DeepSeek / Mistral)、完全本地、开源免费。

### 核心

- **空间(Spaces)** — 按项目分组对话,可置顶、加 emoji + 备注、自由排序、按标签筛选。
- **跨平台** — 一个收件箱同时管理 ChatGPT、Claude、Gemini、DeepSeek、Mistral,同一个空间可以混放任意平台的对话。
- **ZIP 导入** — 把官方导出的 ZIP 丢进来,本地全文搜索每一条历史消息。
- **侧边栏实时抓取** — 在任意支持的 AI 对话网站正常使用时,SpaceMind 静默捕获新对话,不轮询、不走 API。
- **⌘+Shift+K 浮层** — 在支持的网站上一键唤出归档选择器,把当前对话放进某个空间。
- **悬浮按钮** — 网站右侧紫色按钮,给习惯鼠标的用户一个可见入口。

### 进阶

多选(⌘/Ctrl+click 切换、Shift+click 选区间)、跨空间全文搜索、命令面板(⌘K)、深色模式、中英双语、JSON 导入导出、MIT 开源、无账号无统计。

### 隐私

- 仅本地存储(IndexedDB + `chrome.storage.local`),无服务器,无网络请求,无统计。
- 最小权限:`storage` + 仅针对 chatgpt.com / claude.ai / gemini.google.com / chat.deepseek.com / chat.mistral.ai 的站点权限(供侧边栏抓取和浮层使用)。
- MIT 开源,可审计。

详见 [PRIVACY.md](PRIVACY.md)。
