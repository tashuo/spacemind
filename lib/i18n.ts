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
    unsorted: 'Unsorted',
    unsortedSubtitle: 'Conversations not yet assigned to any space.',
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
    unsorted: '未分类',
    unsortedSubtitle: '尚未归入任何空间的对话。',
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
