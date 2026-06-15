import { describe, it, expect } from 'vitest'
import { classifyScript } from './Scanner'

describe('classifyScript', () => {
  it('classifies dev as long-running by name', () => {
    expect(classifyScript('dev', 'vite')).toBe('long-running')
  })
  it('classifies start/serve/watch/preview by name', () => {
    expect(classifyScript('start', 'node server.js')).toBe('long-running')
    expect(classifyScript('serve', 'http-server')).toBe('long-running')
    expect(classifyScript('watch', 'tsc -w')).toBe('long-running')
    expect(classifyScript('preview', 'vite preview')).toBe('long-running')
  })
  it('classifies by known dev-server command', () => {
    expect(classifyScript('app', 'next dev')).toBe('long-running')
    expect(classifyScript('ui', 'webpack serve')).toBe('long-running')
  })
  it('classifies build/lint/test as one-shot', () => {
    expect(classifyScript('build', 'tsc && vite build')).toBe('one-shot')
    expect(classifyScript('lint', 'eslint .')).toBe('one-shot')
    expect(classifyScript('test', 'vitest run')).toBe('one-shot')
  })
})
