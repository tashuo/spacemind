// 内联 SVG 图标:从 spacetab 复用风格,只保留 SpaceMind 当前组件需要用到的几枚。
// 不引图标库是为了零依赖、按需打包,避免拖累 Manager 页 bundle 体积。
interface IconProps {
  className?: string
}

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function X({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function Trash({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export function ChevronDown({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// 右上角斜向外的箭头 —— "在新标签页打开"。
// 与 spacetab 的 ArrowRight 区分,后者是同方向(列表中"移到下一个空间")语义。
export function ExternalLink({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 3h7v7" />
      <path d="M21 3l-9 9" />
      <path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

export function Pencil({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

export function Star({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export function StarFilled({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export function Copy({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function Sparkle({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3 L13.5 8.5 L19 10 L13.5 11.5 L12 17 L10.5 11.5 L5 10 L10.5 8.5 Z" />
      <path d="M19 3 L19.5 4.5 L21 5 L19.5 5.5 L19 7 L18.5 5.5 L17 5 L18.5 4.5 Z" />
    </svg>
  )
}

export function FileText({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 2H6a2 2 0 0 0 -2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

export function Plus({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function Search({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

// 主题切换三态用的图标:太阳(浅色) / 月亮(深色) / 显示器(跟随系统)
export function Sun({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
    </svg>
  )
}

export function Moon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function Monitor({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}
