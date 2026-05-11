import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('vitest works', () => {
    expect(1 + 1).toBe(2)
  })

  it('happy-dom available', () => {
    document.body.innerHTML = '<h1>hi</h1>'
    expect(document.querySelector('h1')?.textContent).toBe('hi')
  })
})
