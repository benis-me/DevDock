import { describe, it, expect } from 'vitest'
import { portFromUrl, detectPortConflict } from './port'

describe('portFromUrl', () => {
  it('extracts an explicit port', () => {
    expect(portFromUrl('http://localhost:5173')).toBe(5173)
    expect(portFromUrl('http://localhost:5173/foo?bar=1')).toBe(5173)
    expect(portFromUrl('http://127.0.0.1:3000')).toBe(3000)
  })
  it('returns null when there is no explicit port', () => {
    expect(portFromUrl('https://app.localhost')).toBeNull()
    expect(portFromUrl('http://localhost')).toBeNull()
  })
  it('returns null for invalid / empty input', () => {
    expect(portFromUrl(undefined)).toBeNull()
    expect(portFromUrl('not a url')).toBeNull()
  })
})

describe('detectPortConflict', () => {
  it('detects node EADDRINUSE messages', () => {
    expect(detectPortConflict('Error: listen EADDRINUSE: address already in use :::5173')).toBe(5173)
    expect(
      detectPortConflict('Error: listen EADDRINUSE: address already in use 127.0.0.1:3000')
    ).toBe(3000)
  })
  it('detects vite strictPort message', () => {
    expect(detectPortConflict('Port 5173 is already in use')).toBe(5173)
    expect(detectPortConflict('Port 4321 is in use')).toBe(4321)
  })
  it('detects CRA/webpack message', () => {
    expect(detectPortConflict('Something is already running on port 3000.')).toBe(3000)
  })
  it('returns null when there is no conflict', () => {
    expect(detectPortConflict('VITE v7 ready in 300 ms')).toBeNull()
    expect(detectPortConflict('Local: http://localhost:5173/')).toBeNull()
  })
})
