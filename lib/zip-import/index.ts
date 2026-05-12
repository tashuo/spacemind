import JSZip from 'jszip'
import type { Conversation, Message } from '../schema'
import { parseChatGPTExport } from './chatgpt'
import { parseClaudeExport } from './claude'

export type Vendor = 'chatgpt' | 'claude'

export interface ImportResult {
  vendor: Vendor
  conversations: Conversation[]
  messages: Message[]
}

// 自定义 Error 子类:调用方可通过 instanceof + code 区分失败原因,做差异化提示
export class ZipImportError extends Error {
  constructor(
    public readonly code: 'no-conversations-json' | 'unknown-vendor' | 'parse-error',
    message: string,
  ) {
    super(message)
    this.name = 'ZipImportError'
  }
}

export function detectVendor(parsed: unknown): Vendor | null {
  if (!Array.isArray(parsed) || parsed.length === 0) return null
  const first = parsed[0]
  if (!first || typeof first !== 'object') return null
  // ChatGPT 导出每个会话带 `mapping`(消息节点树)
  if (
    'mapping' in first &&
    typeof (first as Record<string, unknown>).mapping === 'object'
  )
    return 'chatgpt'
  // Claude 导出每个会话带 `chat_messages` 线性数组 + `uuid`
  if ('chat_messages' in first && 'uuid' in first) return 'claude'
  return null
}

export async function importFromZipBuffer(buf: ArrayBuffer): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(buf)
  const file = zip.file('conversations.json')
  if (!file)
    throw new ZipImportError(
      'no-conversations-json',
      'No conversations.json found in archive',
    )

  const text = await file.async('string')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new ZipImportError(
      'parse-error',
      `Invalid JSON in conversations.json: ${(e as Error).message}`,
    )
  }

  const vendor = detectVendor(parsed)
  if (!vendor)
    throw new ZipImportError(
      'unknown-vendor',
      'Could not detect vendor from conversations.json shape',
    )

  if (vendor === 'chatgpt') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = parseChatGPTExport(parsed as any)
    return { vendor, ...r }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = parseClaudeExport(parsed as any)
  return { vendor, ...r }
}
