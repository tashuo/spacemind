import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scrapeClaudeSidebar } from '@/lib/sidebar-scrape/claude'

// __dirname 在 ESM 下不存在,这里手动从 import.meta.url 还原
const __dirname = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(__dirname, '../../fixtures/claude-sidebar.html'), 'utf8')

describe('scrapeClaudeSidebar', () => {
  it('extracts conversation refs from anchor hrefs', () => {
    document.body.innerHTML = html
    const result = scrapeClaudeSidebar(document)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      id: '0a1b2c3d-4567-89ab-cdef-0123456789ab',
      url: 'https://claude.ai/chat/0a1b2c3d-4567-89ab-cdef-0123456789ab',
      title: 'Tailwind dark mode',
    })
  })

  it('returns empty array when sidebar is missing', () => {
    document.body.innerHTML = '<div></div>'
    expect(scrapeClaudeSidebar(document)).toEqual([])
  })

  it('dedupes anchors pointing to the same conversation id', () => {
    document.body.innerHTML = `
      <aside><nav>
        <a href="/chat/0a1b2c3d-4567-89ab-cdef-0123456789ab">T1</a>
        <a href="/chat/0a1b2c3d-4567-89ab-cdef-0123456789ab">T1 dup</a>
      </nav></aside>
    `
    const result = scrapeClaudeSidebar(document)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('0a1b2c3d-4567-89ab-cdef-0123456789ab')
  })
})
