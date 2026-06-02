# Privacy Policy · SpaceMind

**Effective:** 2026-05-15
**Last updated:** 2026-06-02

> **TL;DR** — SpaceMind does not collect, transmit, or sell any data. Everything you create stays on your device, in your browser, and never leaves it.

---

## 1. What we collect

**Nothing.** SpaceMind has no analytics, no telemetry, no crash reporting, no remote logging, and no servers. We never see your conversations, browsing history, or any activity.

## 2. What is stored, and where

The data SpaceMind creates lives entirely in your browser's local storage (`chrome.storage.local`) and a local IndexedDB database in your browser profile. It is bound to your installation of Chrome on this device and is **not** synchronized to any cloud service or other browser by SpaceMind.

The stored data includes:

- **Spaces** — names, emoji, notes, pinned / order metadata
- **Conversations** — id, platform (ChatGPT / Claude / Gemini / DeepSeek / Mistral), URL, title, optional `spaceId` assignment, tags, starred flag, optional note, `capturedAt`, `platformUpdatedAt`, and short message previews
- **Messages** — when you import a ZIP export from ChatGPT or Claude, the full message content (title + role + content + timestamp) is stored locally so you can search it
- **Preferences** — theme (system / light / dark), language, and the keyboard binding for the Cmd+Shift+K overlay

You can export everything as a JSON file at any time, or import a JSON file you previously exported. Export files only go where you put them — they are never uploaded.

## 3. Permissions

SpaceMind requests a minimal set of Chrome permissions. Each is used only for the feature it enables:

| Permission | Why we need it |
|---|---|
| `storage` | Persist your spaces, conversations, and messages locally in `chrome.storage.local` and a local IndexedDB database so they survive browser restarts. |
| `host_permissions` for `chatgpt.com`, `claude.ai`, `gemini.google.com`, `chat.deepseek.com`, and `chat.mistral.ai` | A content script runs in your tabs on these AI chat sites to read the sidebar DOM and identify the conversations in your own account, and to render the Cmd+Shift+K overlay on the page. No data is transmitted off your device; the DOM is only read inside your tab. |

We do **not** request `tabs`, `tabGroups`, `<all_urls>`, or any other elevated capabilities.

## 4. Third parties

SpaceMind does **not** integrate any third-party SDK, analytics service, A/B testing tool, or advertising network. It does not send data to OpenAI, Anthropic, Google, DeepSeek, Mistral, or any other party.

The supported AI chat pages (`chatgpt.com`, `claude.ai`, `gemini.google.com`, `chat.deepseek.com`, `chat.mistral.ai`) are accessed only via SpaceMind's content scripts, which **read** the DOM to identify your conversations and render the overlay. The content scripts never inject scripts into those pages, never modify their content, and never call those services' APIs on your behalf.

## 5. Network

SpaceMind itself makes **no** outbound network requests. The extension is a static page bundle plus a service worker and content scripts; none of them contacts a SpaceMind server (we don't have one).

The only network traffic from SpaceMind's perspective is your normal browsing — when you click a saved conversation, your browser navigates to the conversation's site (e.g. `chatgpt.com`, `claude.ai`, `gemini.google.com`, `chat.deepseek.com`, `chat.mistral.ai`) the same way it would if you typed the URL yourself. That is your own browsing activity, not telemetry.

## 6. Children

SpaceMind is a productivity tool with no user accounts and no targeted content. We do not knowingly direct it at users under 13.

## 7. Changes to this policy

If we ever change how SpaceMind handles data, this file will be updated and the "Last updated" date above will change. Because the policy is hosted in the project's git history, you can always see exactly what changed and when.

## 8. Contact

Issues, questions, or concerns: open an issue at <https://github.com/tashuo/spacemind/issues>.

---

# 隐私政策 · SpaceMind(中文)

**生效日期:** 2026-05-15
**最后更新:** 2026-05-15

> **简而言之** — SpaceMind 不收集、不上传、不出售任何数据。你创建的所有内容都留在你自己的浏览器里,从不离开你的设备。

---

## 1. 收集什么

**什么都不收集**。SpaceMind 没有埋点、没有遥测、没有崩溃上报、没有远程日志,也没有任何服务器。我们看不到你的对话、浏览记录或任何使用行为。

## 2. 存储什么、存到哪里

SpaceMind 创建的数据完全保存在你浏览器本地(`chrome.storage.local`)以及浏览器配置文件中的一个本地 IndexedDB 数据库里。它绑定在你这台设备上的 Chrome 安装中,**不会** 被 SpaceMind 同步到任何云服务,也不会同步到你其他设备的 Chrome。

存储内容包括:

- **空间** — 名称、emoji、备注、置顶 / 排序元数据
- **会话(Conversations)** — id、平台(ChatGPT / Claude)、URL、标题、可选的 `spaceId` 归属、标签、星标、可选备注、`capturedAt`、`platformUpdatedAt`,以及简短的消息预览
- **消息(Messages)** — 当你导入 ChatGPT 或 Claude 的 ZIP 导出时,完整的消息内容(标题 + 角色 + 内容 + 时间戳)会被保存在本地,供你后续搜索
- **偏好** — 主题(跟随系统 / 浅色 / 深色)、语言,以及 Cmd+Shift+K 唤起浮层的快捷键绑定

你可以随时把全部数据导出成一个 JSON 文件,也可以把之前导出的 JSON 重新导入。导出的文件只去你指定的地方,绝不会被上传。

## 3. 权限

SpaceMind 申请的 Chrome 权限非常克制,每个权限只服务于它启用的功能:

| 权限 | 为什么需要 |
|---|---|
| `storage` | 把你的空间、会话和消息保存在本地(`chrome.storage.local` + 本地 IndexedDB 数据库),让它们在重启浏览器后依然可用。 |
| `chatgpt.com` 与 `claude.ai` 的 `host_permissions` | 在你的 ChatGPT 和 Claude 标签页中运行内容脚本,**读取** 侧边栏 DOM 来识别你自己账号下的会话列表,并在页面上渲染 Cmd+Shift+K 浮层。数据不会被传到任何地方,DOM 只在你当前这个标签页内被读取。 |

我们 **不** 申请 `tabs`、`tabGroups`、`<all_urls>` 或任何其他高权限。

## 4. 第三方

SpaceMind **不** 集成任何第三方 SDK、分析服务、A/B 测试工具或广告网络。不向 Anthropic、OpenAI、Google 或任何其他方发送数据。

ChatGPT(`chatgpt.com`)和 Claude(`claude.ai`)的页面只通过 SpaceMind 的内容脚本访问,而这些内容脚本只 **读取** DOM 来识别你的会话和渲染浮层,**从不** 向这些页面注入脚本、修改其内容,也 **不** 代表你调用它们的 API。

## 5. 网络

SpaceMind 自身 **不** 发起任何对外网络请求。整个扩展只是一个静态页面包加一个 service worker 和几个内容脚本,它们都不会去联络任何 SpaceMind 服务器(因为我们根本没有服务器)。

从 SpaceMind 的角度看,唯一的网络流量就是你正常的浏览行为 — 当你点击一条已保存的会话时,浏览器会像你自己输入网址那样跳转到 `chatgpt.com` 或 `claude.ai`。这属于你自己的浏览行为,不是遥测。

## 6. 儿童

SpaceMind 是一款生产力工具,没有用户账号,没有针对性的内容。我们不会刻意把它面向 13 岁以下的儿童。

## 7. 政策变更

如果 SpaceMind 处理数据的方式有任何变化,本文档会被更新,顶部的「最后更新」日期会随之变化。由于政策托管在项目 git 历史中,你随时可以查看每一次具体改动。

## 8. 联系方式

任何问题、疑问或反馈,请到 <https://github.com/tashuo/spacemind/issues> 开 issue。
