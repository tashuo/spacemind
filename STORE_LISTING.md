# Chrome Web Store — Listing Copy & Submission Fields

Draft content for the Chrome Web Store developer dashboard. Copy/paste into the
matching fields. Not shipped in the extension.

---

## 1. Basic fields

| Field | Value |
|---|---|
| **Name** | SpaceMind |
| **Summary** (≤132 chars) | Organize ChatGPT, Claude, Gemini, DeepSeek & Mistral chats into project spaces. Local-first, no account, open source. |
| **Category** | Productivity |
| **Language** | English (default). Also add 中文 (简体) if offering localized listing. |
| **Privacy policy URL** | https://github.com/tashuo/spacemind/blob/main/PRIVACY.md |
| **Homepage / Support URL** | https://github.com/tashuo/spacemind |

---

## 2. Detailed description (English)

```
SpaceMind organizes your AI conversations into named "spaces" — one per project,
research thread, or personal context — across ChatGPT, Claude, Gemini, DeepSeek,
and Mistral.

Everything stays on your device. No account, no telemetry, no servers. The code
is MIT open source.

— FEATURES —

• Spaces — group conversations by project. Pin favourites, add an emoji + note,
  reorder freely, filter by tags.
• Cross-platform — one inbox for ChatGPT, Claude, Gemini, DeepSeek, and Mistral.
  A single space can hold threads from any of them.
• Real-time sidebar capture — as you chat on a supported site, SpaceMind silently
  records new conversations from the page's own sidebar. No polling, no API calls.
• One-keystroke filing — press Cmd/Ctrl+Shift+K (or click the floating button) on
  any supported site to file the current conversation into a space.
• ZIP import — drop your official ChatGPT or Claude export and search every message
  you've ever sent, fully locally.
• Full-text search — across titles and message bodies, with proper Chinese/CJK
  tokenization.
• Multi-select & bulk actions — Cmd/Ctrl+click to toggle, Shift+click for ranges;
  bulk move, delete, star.
• Command palette (Cmd/Ctrl+K) — every action one keystroke away.
• Dark mode, English + 简体中文, JSON export/import.

— PRIVACY —

SpaceMind stores everything in your browser's local IndexedDB and chrome.storage.
local. It makes no outbound network requests, integrates no analytics or ad SDKs,
and sends nothing to OpenAI, Anthropic, Google, DeepSeek, Mistral, or us. Content
scripts only READ the page DOM inside your own tabs to identify your conversations
and render the overlay — they never modify the page or call any service's API.

Permissions: "storage" plus host access to the five supported chat sites only.

Open source: https://github.com/tashuo/spacemind
Privacy policy: https://github.com/tashuo/spacemind/blob/main/PRIVACY.md
```

---

## 3. 详细描述（简体中文，如提供中文 listing）

```
SpaceMind 把你的 AI 对话整理成命名的「空间(Space)」—— 每个项目、每条研究线索
或每个场景一个空间 —— 覆盖 ChatGPT、Claude、Gemini、DeepSeek、Mistral 五家。

所有数据都留在你的设备上。无账号、无遥测、无服务器。代码 MIT 开源。

— 功能 —

• 空间 —— 按项目分组对话,可置顶、加 emoji + 备注、自由排序、按标签筛选。
• 跨平台 —— 一个收件箱管理 ChatGPT / Claude / Gemini / DeepSeek / Mistral,
  同一个空间可以混放任意平台的对话。
• 侧边栏实时捕获 —— 在支持的网站正常聊天时,SpaceMind 从页面自带的侧边栏静默
  记录新对话,不轮询、不走 API。
• 一键归档 —— 在任意支持的网站按 Cmd/Ctrl+Shift+K(或点右下角悬浮按钮),把当前
  对话放进某个空间。
• ZIP 导入 —— 把官方导出的 ChatGPT / Claude ZIP 丢进来,本地全文搜索每条历史消息。
• 全文搜索 —— 覆盖标题和消息正文,支持中文/CJK 按字分词。
• 多选与批量操作 —— Cmd/Ctrl+点击 切换、Shift+点击 选区间;批量移动、删除、标星。
• 命令面板(Cmd/Ctrl+K)—— 所有操作一个快捷键直达。
• 深色模式、中英双语、JSON 导入导出。

— 隐私 —

SpaceMind 把全部数据存在浏览器本地的 IndexedDB 和 chrome.storage.local,不发起任何
外部网络请求,不接入统计或广告 SDK,不向 OpenAI、Anthropic、Google、DeepSeek、
Mistral 或我们发送任何数据。内容脚本只在你自己的标签页里读取页面 DOM 来识别对话、
渲染浮层,从不修改页面,也不调用任何服务的 API。

权限:仅 "storage" + 对五个支持站点的访问权限。

开源:https://github.com/tashuo/spacemind
隐私政策:https://github.com/tashuo/spacemind/blob/main/PRIVACY.md
```

---

## 4. Privacy practices tab (the form Google makes you fill)

**Single purpose** (one sentence):
```
SpaceMind organizes a user's own AI chat conversations from supported sites
(ChatGPT, Claude, Gemini, DeepSeek, Mistral) into local project "spaces" for
searching and revisiting.
```

**Permission justifications:**

| Item | Justification to paste |
|---|---|
| `storage` | Stores the user's spaces, conversation index, imported messages, and preferences locally in chrome.storage.local and IndexedDB so they persist across browser restarts. No data leaves the device. |
| Host permission: `chatgpt.com` | A content script reads the page's own conversation sidebar to identify the user's conversations and renders the in-page Cmd+Shift+K filing overlay. DOM is read only inside the user's tab; nothing is transmitted off-device. |
| Host permission: `claude.ai` | Same as above, for Claude. |
| Host permission: `gemini.google.com` | Same as above, for Gemini. |
| Host permission: `chat.deepseek.com` | Same as above, for DeepSeek. |
| Host permission: `chat.mistral.ai` | Same as above, for Mistral. |

**Data usage disclosures (checkboxes):**
- Does your item collect or use user data? → Technically it READS conversation
  metadata locally, but **transmits nothing**. Select that you do **not** sell
  data, do **not** transfer for purposes unrelated to the single purpose, and do
  **not** use it for creditworthiness/lending.
- "I certify the data is not transmitted off the user's device" — true.
- Remote code: **No** — the extension runs only bundled code; no remote scripts.

---

## 5. Visual assets checklist

| Asset | Spec | Status |
|---|---|---|
| Store icon | 128×128 PNG | ✅ public/icon/128.png (or assets/branding/icon-source-1024.png downscaled) |
| Screenshot(s) | 1280×800 or 640×400 PNG/JPG, at least 1 (up to 5) | ⬜ TODO |
| Small promo tile (optional) | 440×280 | ⬜ optional |
| Marquee promo (optional) | 1400×560 | ⬜ optional |

**Suggested screenshots:**
1. Manager page with several spaces populated + a conversation grid.
2. The Cmd+Shift+K overlay open on a supported chat site (shows the floating picker).
3. Full-text search with results highlighted across spaces.
4. Command palette (Cmd/Ctrl+K) open.
5. Tag filter + multi-select bulk move in action.

---

## 6. Submission steps

1. `npm run zip` → produces `.output/spacemind-1.0.0-chrome.zip`.
2. Pay the one-time $5 developer registration (if not already done).
3. Create a new item, upload the zip.
4. Fill the listing fields (sections 1–3 above).
5. Fill the Privacy practices tab (section 4).
6. Upload screenshots (section 5).
7. Submit for review. First review typically takes a few days; the broad host
   permissions across 5 sites may draw extra scrutiny — the justifications above
   address it directly.
```
