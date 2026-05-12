import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { importFromZipBuffer, detectVendor } from '@/lib/zip-import'
import chatgptSample from '../../fixtures/chatgpt-export-sample.json'
import claudeSample from '../../fixtures/claude-export-sample.json'

async function makeChatGPTZip(): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('conversations.json', JSON.stringify(chatgptSample))
  zip.file('chat.html', '<html></html>') // OpenAI exports include this
  zip.file('user.json', '{"id": "user-x"}')
  return zip.generateAsync({ type: 'arraybuffer' })
}

async function makeClaudeZip(): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('conversations.json', JSON.stringify(claudeSample))
  zip.file('users.json', '[]') // Anthropic shape
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('detectVendor', () => {
  it('identifies ChatGPT by mapping-tree shape', () => {
    expect(detectVendor(chatgptSample)).toBe('chatgpt')
  })
  it('identifies Claude by chat_messages array', () => {
    expect(detectVendor(claudeSample)).toBe('claude')
  })
  it('returns null on unknown shape', () => {
    expect(detectVendor([{ foo: 'bar' }])).toBeNull()
  })
})

describe('importFromZipBuffer', () => {
  it('parses a ChatGPT export end-to-end', async () => {
    const buf = await makeChatGPTZip()
    const result = await importFromZipBuffer(buf)
    expect(result.vendor).toBe('chatgpt')
    expect(result.conversations.length).toBeGreaterThan(0)
    expect(result.messages.length).toBeGreaterThan(0)
  })

  it('parses a Claude export end-to-end', async () => {
    const buf = await makeClaudeZip()
    const result = await importFromZipBuffer(buf)
    expect(result.vendor).toBe('claude')
    expect(result.conversations.length).toBeGreaterThan(0)
  })

  it('throws a typed error if conversations.json is missing', async () => {
    const zip = new JSZip()
    zip.file('something-else.json', '[]')
    const buf = await zip.generateAsync({ type: 'arraybuffer' })
    await expect(importFromZipBuffer(buf)).rejects.toThrow(/conversations\.json/)
  })

  it('throws a typed error if vendor cannot be detected', async () => {
    const zip = new JSZip()
    zip.file('conversations.json', JSON.stringify([{ foo: 'bar' }]))
    const buf = await zip.generateAsync({ type: 'arraybuffer' })
    await expect(importFromZipBuffer(buf)).rejects.toThrow(/vendor/i)
  })
})
