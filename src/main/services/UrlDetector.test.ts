import { describe, it, expect } from 'vitest'
import { stripAnsi, detectUrls } from './UrlDetector'

describe('stripAnsi', () => {
  it('removes CSI color codes (real ESC)', () => {
    expect(stripAnsi('[32mhello[0m')).toBe('hello')
  })
  it('does not corrupt plain text without ANSI', () => {
    expect(stripAnsi('http://localhost:5173/')).toBe('http://localhost:5173/')
  })
  it('removes OSC hyperlink wrappers', () => {
    expect(stripAnsi(']8;;http://xlink]8;;')).toBe('link')
  })
})

describe('detectUrls', () => {
  it('detects localhost with port', () => {
    expect(detectUrls('Server running at http://localhost:5173/')).toEqual([
      'http://localhost:5173/'
    ])
  })
  it('detects 127.0.0.1', () => {
    expect(detectUrls('listening on http://127.0.0.1:3000')).toEqual(['http://127.0.0.1:3000'])
  })
  it('detects portless *.localhost', () => {
    expect(detectUrls('ready at https://my-app.localhost')).toEqual(['https://my-app.localhost'])
  })
  it('skips LAN lines, keeps loopback', () => {
    const out = 'VITE ready\n  Network: http://192.168.1.5:5173/\n  Local:   http://localhost:5173/\n'
    expect(detectUrls(out)).toEqual(['http://localhost:5173/'])
  })
  it('handles real ANSI-wrapped vite output', () => {
    const out = '  [32m➜[0m  [1mLocal[0m:   [36mhttp://localhost:4321/[0m'
    expect(detectUrls(out)).toEqual(['http://localhost:4321/'])
  })
  it('collects multiple services from one chunk (front + back)', () => {
    const out = '  Local:   http://localhost:5173/\n[api] http://localhost:3000\n'
    expect(detectUrls(out)).toEqual(['http://localhost:5173/', 'http://localhost:3000'])
  })
  it('ignores LAN / Network addresses (loopback only)', () => {
    expect(detectUrls('  Network: http://192.168.1.5:5173/')).toEqual([])
  })
  it('returns [] when no url', () => {
    expect(detectUrls('compiling...')).toEqual([])
  })
})
