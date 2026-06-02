import { useEffect, useState } from 'react'

// SpaceMind 暂时只做 en / zh-CN 两种语言;后续按需再扩。
export type Lang = 'en' | 'zh-CN'
export const LANGS: Lang[] = ['en', 'zh-CN']
export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  'zh-CN': '简体中文',
}

const DEFAULT_LANG: Lang = 'en'
const STORAGE_KEY = 'lang'

// 平台无关:这里不出现 "tab",而用 "conversation",和 SpaceMind 的数据模型对齐。
const messages: Record<Lang, Record<string, string>> = {
  en: {
    // 应用
    appName: 'SpaceMind',
    appTagline: 'Conversations, organized.',

    // 通用动作
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    rename: 'Rename',
    duplicate: 'Duplicate',
    expand: 'Expand',
    collapse: 'Collapse',
    loading: 'Loading…',
    close: 'Close',

    // 空间卡片
    spaces: 'Spaces',
    newSpace: 'New space',
    newSpaceName: 'Space name',
    create: 'Create',
    spacesCount: '{n} spaces',
    conversationsCount: '{n} conversations',
    spacesAndConversations: '{s} spaces · {c} conversations',
    pinSpace: 'Pin',
    unpinSpace: 'Unpin',
    editEmoji: 'Set emoji',
    editNote: 'Edit note',
    emojiPlaceholder: '🌱 (optional)',
    notePlaceholder: 'Space note…',
    confirmDeleteSpace: 'Delete space "{name}"? Its {n} conversations will be moved to Unsorted.',

    // 对话行
    openInNewTab: 'Open in new tab',
    moveToSpace: 'Move to space',
    moveTo: 'Move to…',
    moveToUnsorted: 'Unsorted',
    removeConversation: 'Remove',
    confirmRemoveConversations: 'Remove {n} conversations?',
    platformChatgpt: 'ChatGPT',
    platformClaude: 'Claude',
    platformGemini: 'Gemini',
    platformDeepseek: 'DeepSeek',
    platformMistral: 'Mistral',
    starConversation: 'Star',
    unstarConversation: 'Unstar',
    editTags: 'Edit tags',
    addTag: 'Add tag',
    addTagPlaceholder: 'Add a tag…',
    removeTag: 'Remove tag {name}',
    suggestionsLabel: 'Existing tags',
    editConvNote: 'Edit note',
    convNotePlaceholder: 'Why is this conversation interesting?',
    noteLabel: 'Note',
    saveNote: 'Save',
    clearNote: 'Clear',
    filterByTag: 'Filter by "{name}"',
    filteringBy: 'Filtering by',
    removeTagFilter: 'Remove filter {name}',
    clearFilter: 'Clear filter',

    // 多选 / 批量
    selectionCount: '{n} selected',
    openSelected: 'Open all',
    removeSelected: 'Remove',
    clearSelection: 'Cancel',

    // 空态
    emptySpacesTitle: 'No spaces yet',
    emptySpacesSubtitle: 'Create a space or import a ChatGPT/Claude export to get started.',
    emptyConversationsTitle: 'No conversations yet',
    emptyConversationsSubtitle: 'Import a platform export, or move conversations here.',

    // 空间卡片内部
    cardNoConversations: 'No conversations in this space yet. Drag conversations here, or use "Move to…" from another card.',
    dropConversationHere: 'Drop conversation to add it to this space',
    noOtherSpaces: 'No other spaces yet — create one first',
    toastCaptured: 'Captured {n} new conversation(s) from {platform}',
    unsorted: 'Unsorted',
    unsortedSubtitle: 'Auto-captured from your ChatGPT / Claude / Gemini / DeepSeek / Mistral sidebar · drag into a space.',
    cardNoConversationsUnsorted: 'No unsorted conversations.',
    conversationsLabel: 'conversations',
    confirmDeleteSpaceShort: 'Delete space "{name}"?',

    // Toast
    toastImported: 'Imported {n} from {vendor}',
    toastImportFailed: 'Import failed, please retry',
    toastSaveFailed: 'Failed to save',
    toastMoved: 'Moved {n} to "{name}"',
    toastMoveFailed: 'Move failed, please retry',
    toastRemoved: 'Removed {n} conversations',
    toastSpaceCreated: 'Created space "{name}"',
    toastSpaceDeleted: 'Deleted space "{name}"',
    toastExported: 'Backup downloaded',
    toastExportFailed: 'Export failed',
    toastImportedSummary: 'Imported {n} items',
    toastImportJsonFailedJson: 'Invalid JSON file',
    toastImportJsonFailedShape: 'Unrecognized backup format',

    // 搜索
    searchPlaceholder: 'Search across all conversations…',
    searchResultsSummary: '{n} results in {s} spaces',
    searchResultsSummaryOne: '{n} result in {s} space',
    clearSearch: 'Clear',
    noSearchResults: 'No matches',

    // 命令面板
    commandPalette: 'Command palette',
    commandPalettePlaceholder: 'Type a command or search…',
    commandGroupAction: 'Actions',
    commandGroupSpace: 'Spaces',
    cmdOpenHelp: 'Open help',
    cmdToggleTheme: 'Toggle theme',
    cmdSwitchLanguage: 'Switch language',
    cmdExportJson: 'Export JSON',
    cmdImportJson: 'Import JSON',
    cmdImportZip: 'Import ZIP (platform export)',
    cmdShowSpace: 'Show: {name}',
    cmdNoResults: 'No matching commands',
    cmdHintFooter: '↵ Run  ·  ↑↓ Select  ·  Esc Close',

    // 帮助
    helpTitle: 'How to use SpaceMind',
    helpSectionImport: 'Importing',
    helpSectionOrganize: 'Organizing',
    helpSectionShortcuts: 'Shortcuts',
    welcomeTitle: 'SpaceMind — Welcome',
    helpIntro:
      'SpaceMind keeps your ChatGPT, Claude, Gemini, DeepSeek and Mistral conversations local, searchable, and organized into project spaces. Everything below also lives behind ⌘K.',
    helpQuickStartHeading: 'Quick start',
    helpQuickStart1:
      'Export your ChatGPT or Claude history (Settings → Privacy → Export data) and wait for the email with a ZIP.',
    helpQuickStart2: 'Drop the ZIP onto the "Import ZIP" button at the top right of the manager.',
    helpQuickStart3:
      'Organize conversations into spaces — drag them, or ⌘/Ctrl+click to select several and "Move to…".',
    helpQuickStart4:
      'On any supported AI chat page (ChatGPT, Claude, Gemini, DeepSeek, Mistral), click the floating SpaceMind button in the bottom-right corner (or press Cmd+Shift+K) to save the current conversation into a space.',
    helpQuickStart5: '⌘K opens the command palette — every action is reachable from there.',
    helpConceptsHeading: 'Core concepts',
    helpConceptSpaceTerm: 'Space',
    helpConceptSpaceDesc:
      'A named bucket for related conversations — e.g. "Thesis", "Side project". Spaces are just folders; conversations stay linkable back to their original URL.',
    helpConceptConversationTerm: 'Conversation',
    helpConceptConversationDesc:
      'A single chat thread from any supported platform (ChatGPT, Claude, Gemini, DeepSeek, Mistral). SpaceMind stores its title, preview, and messages locally so you can search across everything.',
    helpConceptUnsortedTerm: 'Unsorted',
    helpConceptUnsortedDesc:
      'The default bucket newly imported conversations land in. Triage from here into the spaces that fit.',
    helpShortcutsHeading: 'Keyboard shortcuts',
    helpKbdPalette: '⌘K — open the command palette',
    helpKbdOverlay: 'Cmd+Shift+K — save the current page on any supported AI chat site (or click the floating button)',
    helpKbdToggleSelect: '⌘/Ctrl+click on a conversation — toggle select',
    helpKbdRangeSelect: 'Shift+click on a conversation — range select',
    helpKbdEscape: 'Esc — close dialogs / clear search',
    helpPrivacyHeading: 'Privacy',
    helpPrivacy:
      'Everything stays in your browser. No telemetry, no remote sync, no account. SpaceMind is MIT open source — back up regularly via "Export JSON".',

    // 主题 / 语言
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    language: 'Language',

    // 相对时间(供 lib/ui-utils.ts 的 relativeTime 使用)
    timeJustNow: 'just now',
    timeMinutesAgo: '{n} minutes ago',
    timeHoursAgo: '{n} hours ago',
    timeYesterday: 'yesterday',
    timeDaysAgo: '{n} days ago',
    timeWeeksAgo: '{n} weeks ago',
    timeMonthsAgo: '{n} months ago',
    timeYearsAgo: '{n} years ago',
  },
  'zh-CN': {
    // 应用
    appName: 'SpaceMind',
    appTagline: '把 AI 对话整理进项目空间',

    // 通用动作
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    rename: '重命名',
    duplicate: '复制',
    expand: '展开',
    collapse: '收起',
    loading: '加载中…',
    close: '关闭',

    // 空间卡片
    spaces: '空间',
    newSpace: '新建空间',
    newSpaceName: '空间名称',
    create: '创建',
    spacesCount: '{n} 个空间',
    conversationsCount: '{n} 条对话',
    spacesAndConversations: '{s} 个空间 · {c} 条对话',
    pinSpace: '置顶',
    unpinSpace: '取消置顶',
    editEmoji: '设置图标',
    editNote: '编辑备注',
    emojiPlaceholder: '🌱(可选)',
    notePlaceholder: '空间备注…',
    confirmDeleteSpace: '删除空间「{name}」?其中 {n} 条对话会回到「未分类」。',

    // 对话行
    openInNewTab: '在新标签页打开',
    moveToSpace: '移动到空间',
    moveTo: '移到…',
    moveToUnsorted: '未分类',
    removeConversation: '删除',
    confirmRemoveConversations: '删除 {n} 条对话?',
    platformChatgpt: 'ChatGPT',
    platformClaude: 'Claude',
    platformGemini: 'Gemini',
    platformDeepseek: 'DeepSeek',
    platformMistral: 'Mistral',
    starConversation: '加星标',
    unstarConversation: '取消星标',
    editTags: '编辑标签',
    addTag: '添加标签',
    addTagPlaceholder: '添加标签…',
    removeTag: '删除标签 {name}',
    suggestionsLabel: '已有标签',
    editConvNote: '编辑备注',
    convNotePlaceholder: '这条对话为什么值得记一下?',
    noteLabel: '备注',
    saveNote: '保存',
    clearNote: '清空',
    filterByTag: '按 "{name}" 筛选',
    filteringBy: '筛选中',
    removeTagFilter: '移除筛选 {name}',
    clearFilter: '清除筛选',

    // 多选 / 批量
    selectionCount: '已选 {n} 条',
    openSelected: '全部打开',
    removeSelected: '删除',
    clearSelection: '取消',

    // 空态
    emptySpacesTitle: '还没有空间',
    emptySpacesSubtitle: '新建一个空间,或导入 ChatGPT/Claude 的导出包开始使用。',
    emptyConversationsTitle: '还没有对话',
    emptyConversationsSubtitle: '导入平台导出包,或把对话移到这里。',

    // 空间卡片内部
    cardNoConversations: '这个空间还没有对话。可以从其他卡片用「移到…」加入,或拖拽进来。',
    dropConversationHere: '松开鼠标把对话加入这个空间',
    noOtherSpaces: '还没有其他空间 —— 先创建一个',
    toastCaptured: '从 {platform} 捕获了 {n} 条新对话',
    unsorted: '未分类',
    unsortedSubtitle: '自动从你的 ChatGPT / Claude / Gemini / DeepSeek / Mistral 侧边栏捕获 · 拖入空间归类。',
    cardNoConversationsUnsorted: '没有未分类的对话。',
    conversationsLabel: '条对话',
    confirmDeleteSpaceShort: '删除空间「{name}」?',

    // Toast
    toastImported: '已从 {vendor} 导入 {n} 条',
    toastImportFailed: '导入失败,请重试',
    toastSaveFailed: '保存失败',
    toastMoved: '已把 {n} 条移到「{name}」',
    toastMoveFailed: '移动失败,请重试',
    toastRemoved: '已删除 {n} 条对话',
    toastSpaceCreated: '已创建空间「{name}」',
    toastSpaceDeleted: '已删除空间「{name}」',
    toastExported: '备份已下载',
    toastExportFailed: '导出失败',
    toastImportedSummary: '导入了 {n} 项',
    toastImportJsonFailedJson: 'JSON 文件无效',
    toastImportJsonFailedShape: '不是 SpaceMind 备份格式',

    // 搜索
    searchPlaceholder: '搜索所有对话…',
    searchResultsSummary: '在 {s} 个空间中找到 {n} 个结果',
    searchResultsSummaryOne: '在 {s} 个空间中找到 {n} 个结果',
    clearSearch: '清除',
    noSearchResults: '没有匹配',

    // 命令面板
    commandPalette: '命令面板',
    commandPalettePlaceholder: '输入命令或搜索…',
    commandGroupAction: '动作',
    commandGroupSpace: '跳到空间',
    cmdOpenHelp: '打开帮助',
    cmdToggleTheme: '切换主题',
    cmdSwitchLanguage: '切换语言',
    cmdExportJson: '导出 JSON',
    cmdImportJson: '导入 JSON',
    cmdImportZip: '导入 ZIP(平台导出)',
    cmdShowSpace: '跳到:{name}',
    cmdNoResults: '没有匹配的命令',
    cmdHintFooter: '↵ 执行  ·  ↑↓ 选择  ·  Esc 关闭',

    // 帮助
    helpTitle: '如何使用 SpaceMind',
    helpSectionImport: '导入',
    helpSectionOrganize: '整理',
    helpSectionShortcuts: '快捷键',
    welcomeTitle: 'SpaceMind — 欢迎',
    helpIntro:
      'SpaceMind 把你的 ChatGPT、Claude、Gemini、DeepSeek、Mistral 对话保存在本地,可搜索、可分类。下面这些功能也都可以通过 ⌘K 命令面板触达。',
    helpQuickStartHeading: '5 步上手',
    helpQuickStart1: '在 ChatGPT / Claude 设置中导出对话(Settings → Privacy → Export data),等待邮件中的 ZIP。',
    helpQuickStart2: '把 ZIP 拖到管理页右上角的「Import ZIP」按钮上。',
    helpQuickStart3: '把对话归到空间 —— 直接拖动,或用 ⌘/Ctrl+点击 选多条后「Move to…」。',
    helpQuickStart4: '在任意支持的 AI 对话页面(ChatGPT、Claude、Gemini、DeepSeek、Mistral),点击右下角的 SpaceMind 悬浮按钮(或按 Cmd+Shift+K),把当前对话保存到某个空间。',
    helpQuickStart5: '⌘K 打开命令面板 —— 所有操作都可以从这里搜出来。',
    helpConceptsHeading: '核心概念',
    helpConceptSpaceTerm: '空间(Space)',
    helpConceptSpaceDesc: '一组同主题对话的命名集合,如「论文」「副业」。空间只是一层归类,原对话的 URL 仍然能回到平台打开。',
    helpConceptConversationTerm: '对话(Conversation)',
    helpConceptConversationDesc: '一条来自任意支持平台(ChatGPT、Claude、Gemini、DeepSeek、Mistral)的对话。SpaceMind 在本地保存标题、预览和消息,以便跨空间搜索。',
    helpConceptUnsortedTerm: '未分类(Unsorted)',
    helpConceptUnsortedDesc: '新导入的对话默认落入这里。在这里挑选归到合适的空间。',
    helpShortcutsHeading: '快捷键',
    helpKbdPalette: '⌘K —— 打开命令面板',
    helpKbdOverlay: 'Cmd+Shift+K —— 在任意支持的 AI 对话站点上保存当前对话(也可点击右下角悬浮按钮)',
    helpKbdToggleSelect: '⌘/Ctrl+点击对话 —— 切换选中',
    helpKbdRangeSelect: 'Shift+点击对话 —— 选区间',
    helpKbdEscape: 'Esc —— 关闭弹窗 / 清空搜索',
    helpPrivacyHeading: '隐私',
    helpPrivacy: '所有数据都在你的浏览器里。无遥测、无远程同步、无账号。SpaceMind 是 MIT 开源 —— 建议定期通过「导出 JSON」备份。',

    // 主题 / 语言
    theme: '主题',
    themeSystem: '跟随系统',
    themeLight: '浅色',
    themeDark: '深色',
    language: '语言',

    // 相对时间
    timeJustNow: '刚刚',
    timeMinutesAgo: '{n} 分钟前',
    timeHoursAgo: '{n} 小时前',
    timeYesterday: '昨天',
    timeDaysAgo: '{n} 天前',
    timeWeeksAgo: '{n} 周前',
    timeMonthsAgo: '{n} 个月前',
    timeYearsAgo: '{n} 年前',
  },
}

export function detectBrowserLang(): Lang {
  let raw = ''
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
      raw = chrome.i18n.getUILanguage()
    } else if (typeof navigator !== 'undefined') {
      raw = navigator.language
    }
  } catch {
    raw = ''
  }
  const lower = raw.toLowerCase()
  // 任意 zh-* 都映射到 zh-CN —— SpaceMind v1 不再区分繁简。
  if (lower.startsWith('zh')) return 'zh-CN'
  return 'en'
}

export async function readLang(): Promise<Lang> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY)
    const v = stored[STORAGE_KEY]
    if (typeof v === 'string' && (LANGS as string[]).includes(v)) return v as Lang
  } catch {
    // 读取失败时降级到浏览器语言检测
  }
  return detectBrowserLang()
}

export async function writeLang(lang: Lang): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: lang })
  } catch {
    // 写入失败静默处理,不阻断用户操作
  }
}

export function format(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>,
): string {
  const dict = messages[lang]
  const fallback = messages[DEFAULT_LANG]
  let s = dict[key] ?? fallback[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return s
}

export function useT(): {
  t: (key: string, params?: Record<string, string | number>) => string
  lang: Lang
  setLang: (l: Lang) => void
} {
  // 同步初始化避免首帧白屏
  const [lang, setLangState] = useState<Lang>(detectBrowserLang())

  useEffect(() => {
    let mounted = true
    void readLang().then((l) => {
      if (mounted) setLangState(l)
    })
    const onChange = (
      changes: { [k: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== 'local') return
      const change = changes[STORAGE_KEY]
      if (change && typeof change.newValue === 'string') {
        if ((LANGS as string[]).includes(change.newValue)) {
          setLangState(change.newValue as Lang)
        }
      }
    }
    try {
      chrome.storage.onChanged.addListener(onChange)
    } catch {
      // 非扩展环境(dev / 测试)下忽略
    }
    return () => {
      mounted = false
      try {
        chrome.storage.onChanged.removeListener(onChange)
      } catch {
        // 同上
      }
    }
  }, [])

  const t = (key: string, params?: Record<string, string | number>) =>
    format(lang, key, params)
  const setLang = (l: Lang) => {
    setLangState(l) // 乐观更新,UI 立即响应
    void writeLang(l)
  }
  return { t, lang, setLang }
}
