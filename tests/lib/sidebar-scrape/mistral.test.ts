import { describe, it, expect } from 'vitest'
import { scrapeMistralSidebar } from '@/lib/sidebar-scrape/mistral'

describe('scrapeMistralSidebar', () => {
  it('extracts /chat/<uuid> conversation refs', () => {
    document.body.innerHTML = `
      <a href="/chat/uuid-1">First</a>
      <a href="/chat/uuid-2">Second</a>
      <a href="/account">不算</a>
    `
    const result = scrapeMistralSidebar(document)
    expect(result.map((r) => r.id)).toEqual(['uuid-1', 'uuid-2'])
    expect(result[0]!.url).toBe('https://chat.mistral.ai/chat/uuid-1')
  })

  it('dedupes by id', () => {
    document.body.innerHTML = `
      <a href="/chat/a">X</a>
      <a href="/chat/a">X dup</a>
    `
    expect(scrapeMistralSidebar(document)).toHaveLength(1)
  })
})
