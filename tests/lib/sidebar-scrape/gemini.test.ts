import { describe, it, expect } from 'vitest'
import { scrapeGeminiSidebar } from '@/lib/sidebar-scrape/gemini'

describe('scrapeGeminiSidebar', () => {
  it('extracts /app/<id> conversation refs', () => {
    document.body.innerHTML = `
      <nav>
        <a href="/app/abc123">Hello Gemini</a>
        <a href="/app/def456">Another chat</a>
        <a href="/settings">不算</a>
      </nav>
    `
    const result = scrapeGeminiSidebar(document)
    expect(result.map((r) => r.id)).toEqual(['abc123', 'def456'])
    expect(result[0]!.url).toBe('https://gemini.google.com/app/abc123')
  })

  it('falls back to id as title when anchor text is empty', () => {
    document.body.innerHTML = `<a href="/app/empty"></a>`
    const r = scrapeGeminiSidebar(document)
    expect(r[0]!.title).toBe('empty')
  })

  it('dedupes duplicates', () => {
    document.body.innerHTML = `
      <a href="/app/x">A</a>
      <a href="/app/x">A dup</a>
    `
    expect(scrapeGeminiSidebar(document)).toHaveLength(1)
  })
})
