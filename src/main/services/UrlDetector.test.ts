import { describe, it, expect } from 'vitest'
import { stripAnsi, detectUrl } from './UrlDetector'

describe('stripAnsi', () => {
  it('removes ANSI escape codes', () => {
    expect(stripAnsi('[32mhello[0m')).toBe('hello')
  })
})

describe('detectUrl', () => {
  it('detects localhost with port', () => {
    expect(detectUrl('Server running at http://localhost:5173/')).toBe('http://localhost:5173/')
  })

  it('detects 127.0.0.1', () => {
    expect(detectUrl('listening on http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000')
  })

  it('detects portless *.localhost', () => {
    expect(detectUrl('ready at https://my-app.localhost')).toBe('https://my-app.localhost')
  })

  it('prefers the line mentioning Local', () => {
    const out = 'VITE ready\n  ➜  Network: http://192.168.1.5:5173/\n  ➜  Local:   http://localhost:5173/\n'
    expect(detectUrl(out)).toBe('http://localhost:5173/')
  })

  it('handles ANSI-wrapped vite output', () => {
    const out = '  [32m➜[0m  [1mLocal[0m:   [36mhttp://localhost:4321/[0m'
    expect(detectUrl(out)).toBe('http://localhost:4321/')
  })

  it('returns null when no url', () => {
    expect(detectUrl('compiling...')).toBeNull()
  })
})
