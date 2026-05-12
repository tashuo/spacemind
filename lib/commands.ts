// 命令面板的纯逻辑层:与 React / DOM 解耦,方便单测和复用。
// 与 SpaceTab 的 commands.ts 同形;SpaceMind v1 把 group 限为 action/space 两类,
// 暂不引入 navigation / settings 等更细分组,够用就好。

export type CommandGroup = 'action' | 'space'

export interface Command {
  id: string
  group: CommandGroup
  label: string
  /** 副标(更小,灰色),用于显示空间标签数 / 动作描述等 */
  description?: string
  /** 副标右侧的小色标(用于空间) */
  accent?: string
  /** 按下 Enter 触发 */
  perform: () => void
}

function normalizeQuery(raw: string): string[] {
  const trimmed = raw.trim().toLowerCase()
  if (trimmed.length === 0) return []
  return trimmed.split(/\s+/)
}

/**
 * 过滤命令:多 term AND 匹配 label + description。空 query 返回原数组。
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const terms = normalizeQuery(query)
  if (terms.length === 0) return commands
  return commands.filter((c) => {
    const haystack = `${c.label} ${c.description ?? ''}`.toLowerCase()
    return terms.every((t) => haystack.includes(t))
  })
}

/**
 * 按 group 分组,保持原数组内的顺序。返回有序数组,以便 UI 按特定顺序渲染。
 */
export function groupCommands(
  commands: Command[],
): Array<{ group: CommandGroup; items: Command[] }> {
  const order: CommandGroup[] = ['action', 'space']
  const buckets = new Map<CommandGroup, Command[]>()
  for (const g of order) buckets.set(g, [])
  for (const c of commands) {
    buckets.get(c.group)?.push(c)
  }
  return order
    .map((g) => ({ group: g, items: buckets.get(g) ?? [] }))
    .filter((x) => x.items.length > 0)
}
