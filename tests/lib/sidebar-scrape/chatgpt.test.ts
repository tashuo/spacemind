import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scrapeChatGPTSidebar } from '@/lib/sidebar-scrape/chatgpt'

// __dirname 在 ESM 下不存在,这里手动从 import.meta.url 还原
const __dirname = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(__dirname, '../../fixtures/chatgpt-sidebar.html'), 'utf8')

describe('scrapeChatGPTSidebar', () => {
  it('extracts conversation refs from anchor hrefs', () => {
    document.body.innerHTML = html
    const result = scrapeChatGPTSidebar(document)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      id: 'conv-1',
      url: 'https://chatgpt.com/c/conv-1',
      title: 'Centering a div',
    })
  })

  it('returns empty array when sidebar is missing', () => {
    document.body.innerHTML = '<div></div>'
    expect(scrapeChatGPTSidebar(document)).toEqual([])
  })

  it('dedupes anchors pointing to the same conversation id', () => {
    document.body.innerHTML = `
      <aside><nav>
        <a href="/c/x">T1</a>
        <a href="/c/x">T1 dup</a>
      </nav></aside>
    `
    const result = scrapeChatGPTSidebar(document)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('x')
  })
})
