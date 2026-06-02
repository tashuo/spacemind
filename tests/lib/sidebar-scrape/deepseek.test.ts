import { describe, it, expect } from 'vitest'
import { scrapeDeepSeekSidebar } from '@/lib/sidebar-scrape/deepseek'

describe('scrapeDeepSeekSidebar', () => {
  it('matches both /a/chat/s/<id> and /chat/<id>', () => {
    document.body.innerHTML = `
      <a href="/a/chat/s/foo">Long path</a>
      <a href="/chat/bar">Short path</a>
      <a href="/sign-in">不算</a>
    `
    const result = scrapeDeepSeekSidebar(document)
    expect(result.map((r) => r.id).sort()).toEqual(['bar', 'foo'])
  })

  it('always builds the canonical /a/chat/s/<id> url', () => {
    document.body.innerHTML = `<a href="/chat/short">S</a>`
    const r = scrapeDeepSeekSidebar(document)
    expect(r[0]!.url).toBe('https://chat.deepseek.com/a/chat/s/short')
  })
})
