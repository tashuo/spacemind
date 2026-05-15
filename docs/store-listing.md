# SpaceMind — Chrome Web Store Listing (v1.0.0)

Canonical copy for the Chrome Web Store dashboard. Edit here, paste there.

---

## Category

**Productivity / Workflow & Planning**

## Privacy policy URL

`https://github.com/tashuo/spacemind/blob/main/PRIVACY.md`

## Single-purpose statement

> SpaceMind organises your AI conversations from ChatGPT and Claude into named project spaces, so research, drafts, and prompts across platforms can be saved, searched, and resurfaced from one local-first library.

Short fallback (≤140 chars):

> Organise ChatGPT and Claude conversations into project spaces with full-text search. Local-only, open source.

---

## English (en)

### Short summary (132-char limit)
> Organize ChatGPT & Claude chats into project spaces. Full-text search, ⌘K palette, one-key save. Local-only, open source.

(124 chars)

### Detailed description

```
SpaceMind turns your scattered AI conversations across ChatGPT and Claude into named project spaces — Research, Writing, Coding, anything — and surfaces the right chat the moment you need it.

🌐 CROSS-PLATFORM
One library for both ChatGPT (chatgpt.com) and Claude (claude.ai). Stop juggling tabs and bookmarks. Every conversation lives in the same searchable index, regardless of which model produced it.

⚡ ONE-KEY SAVE
Hit Cmd+Shift+K on any ChatGPT or Claude tab to pop open the SpaceMind overlay. Pick a space, hit Enter, done. A floating button is also available for mouse users.

🔍 FULL-TEXT SEARCH
Powered by FlexSearch. Type a fragment of a question, a code snippet, a name — every message body across every space is indexed. Cross-space or scoped to one space.

⌨️ COMMAND PALETTE (⌘K)
Jump to any space, run actions, toggle theme, import / export — every operation one keystroke away.

✅ POWER FEATURES
• Drag conversations between spaces, drag to reorder, drag spaces onto each other to merge
• Multi-select conversations (⌘/Ctrl+click, Shift+click for ranges) — bulk move, delete, or tag
• ZIP import preserves full message history from ChatGPT and Claude official exports
• Per-space emoji + note, pinning, manual ordering
• Light, dark, and system themes
• Languages: English, 简体中文
• JSON export — your data is portable

🔒 PRIVACY-FIRST
SpaceMind does not collect, transmit, or sell anything. No telemetry, no analytics, no accounts, no servers. Conversations live in chrome.storage.local and IndexedDB on this device. The content scripts read sidebar DOM read-only; nothing leaves your browser.

🆓 OPEN SOURCE
MIT licensed. Audit the code, file issues, contribute features:
https://github.com/tashuo/spacemind

WHY ANOTHER AI CHAT ORGANIZER
SpaceMind sits between ChatGPT's built-in folders (single-platform, server-side, tied to one vendor) and AIPRM (closed-source, paid, ads). Opinionated about a single workflow — project spaces with instant cross-platform search — and refuses to add accounts, sync, or paywalls.
```

---

## 简体中文 (zh-CN)

### 简短描述(132 字符上限)
> 把 ChatGPT 和 Claude 对话整理成项目空间。全文搜索、⌘K 命令面板、一键保存。完全本地、开源免费。

### 详细描述

```
SpaceMind 把你散落在 ChatGPT 和 Claude 各处的 AI 对话整理成命名的「项目空间」(研究 / 写作 / 编码 / 任意主题),需要时一秒找到对应的对话。

🌐 跨平台统一
一个库同时管 ChatGPT(chatgpt.com)和 Claude(claude.ai)。不再在两边的侧边栏和书签之间来回切。所有对话进入同一个可搜索索引,不分模型。

⚡ 一键保存
在任意 ChatGPT 或 Claude 页面按 Cmd+Shift+K,SpaceMind 覆盖层弹出,选择空间、回车,搞定。也有悬浮按钮可供鼠标用户使用。

🔍 全文搜索
基于 FlexSearch。输入问题的片段、代码、名字 — 所有空间内每条消息正文都已建立索引。可跨空间也可限定到单个空间。

⌨️ 命令面板(⌘K)
跳转空间、执行操作、切换主题、导入 / 导出 — 一切都在一个按键之间。

✅ 进阶功能
• 拖拽对话在空间之间移动 / 重新排序,拖动空间卡合并
• 多选对话(⌘/Ctrl+点击切换、Shift+点击选区间)— 批量移动 / 删除 / 打标签
• ZIP 导入完整保留 ChatGPT 和 Claude 官方导出的全部消息历史
• 每空间 emoji + 备注、置顶、手动排序
• 浅色、深色、跟随系统三种主题
• 语言:English、简体中文
• JSON 导出 — 数据是你自己的

🔒 隐私优先
SpaceMind 不收集、不上传、不出售任何数据。没有埋点、没有分析、没有账号、没有服务器。所有对话存在你设备的 chrome.storage.local 和 IndexedDB 里。内容脚本只读取侧边栏 DOM,不向外发送任何内容。

🆓 开源免费
MIT 协议。审计代码、提 issue、贡献功能:
https://github.com/tashuo/spacemind

为什么再做一个 AI 对话整理工具
SpaceMind 处在 ChatGPT 自带的文件夹(只能管一个平台、绑定一家厂商、存在服务端)和 AIPRM(闭源、付费、含广告)之间。它对单一工作流很有主张 — 项目空间 + 跨平台全文搜索 — 并坚决拒绝加账号系统、云同步、付费墙。
```

---

## Permission justifications

Paste each into the corresponding field on the Privacy practices tab.

### `storage`
> Required to persist the user's spaces, conversations, and message history across browser restarts. Data is stored in chrome.storage.local (metadata) and IndexedDB (message bodies + FlexSearch index) on the user's device. Nothing is transmitted off-device.

### Host permission: `https://chatgpt.com/*`
> Required so the content script can read the sidebar DOM of chatgpt.com to silently capture the user's conversation list, and to inject the Cmd+Shift+K overlay and floating save button on that origin. DOM access is read-only; no content is transmitted off-device. Scoped to chatgpt.com only — no `<all_urls>`.

### Host permission: `https://claude.ai/*`
> Required so the content script can read the sidebar DOM of claude.ai to silently capture the user's conversation list, and to inject the Cmd+Shift+K overlay and floating save button on that origin. DOM access is read-only; no content is transmitted off-device. Scoped to claude.ai only — no `<all_urls>`.

### Remote code
> No remote code. Static bundle + service worker; no JavaScript fetched at runtime.

---

## Host permission justification

SpaceMind requests host permissions for exactly two origins:

- `https://chatgpt.com/*`
- `https://claude.ai/*`

On both origins, the content script:

1. Reads the sidebar DOM to silently capture the user's conversation list so SpaceMind can offer to save them into a space.
2. Renders the Cmd+Shift+K overlay (and a floating save button) so the user can file the current conversation into a space with a single keystroke.

Access is strictly read-only. No DOM content, conversation text, or user identifier is transmitted off-device. No `<all_urls>` permission is requested — only the two AI chat origins SpaceMind actually integrates with.

---

## Other dashboard fields

| Field | Value |
|---|---|
| Support email | (your email) |
| Website | `https://github.com/tashuo/spacemind` |
| Issues / support | `https://github.com/tashuo/spacemind/issues` |
| Pricing | Free |
| Distribution | Public |
| Regions | All regions |

---

## Screenshot order (5 max, 1280×800 each)

1. `01-hero.png` — Manager with 3–5 spaces, some containing conversations; English UI, light mode
2. `02-palette.png` — ⌘K command palette open showing Actions + Spaces groups
3. `03-overlay.png` — chatgpt.com page with the SpaceMind overlay open + space picker
4. `04-multiselect.png` — Manager with 4 conversations selected + bulk action bar visible
5. `05-dark-search.png` — Dark mode with cross-space search results displayed

---

## Submission checklist

- [ ] Repo public on GitHub (`tashuo/spacemind`)
- [ ] PRIVACY.md returns 200 from incognito
- [ ] zip rebuilt: `pnpm wxt zip` → `.output/spacemind-1.0.0-chrome.zip`
- [ ] Icons present (16 / 32 / 48 / 96 / 128 — currently MISSING, need to generate before final submission)
- [ ] All 5 screenshots prepared at 1280×800 and named `01-…05-`
- [ ] Short description copied (en or zh-CN)
- [ ] Detailed description copied (matching locale)
- [ ] Permission justifications copied (`storage` + 2 host permissions + remote code)
- [ ] Host permission justification pasted
- [ ] Privacy policy URL pasted
- [ ] Single-purpose statement pasted
- [ ] Category: Productivity / Workflow & Planning
- [ ] Submit for review
