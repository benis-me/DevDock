import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { detectPackageManager } from './Scanner'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'devdock-pm-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function touch(name: string): void {
  writeFileSync(join(dir, name), '')
}

describe('detectPackageManager', () => {
  it('detects pnpm from pnpm-lock.yaml', () => {
    touch('pnpm-lock.yaml')
    expect(detectPackageManager(dir)).toBe('pnpm')
  })
  it('detects yarn from yarn.lock', () => {
    touch('yarn.lock')
    expect(detectPackageManager(dir)).toBe('yarn')
  })
  it('detects bun from bun.lockb', () => {
    touch('bun.lockb')
    expect(detectPackageManager(dir)).toBe('bun')
  })
  it('detects bun from bun.lock (bun 1.2+ text lockfile)', () => {
    touch('bun.lock')
    expect(detectPackageManager(dir)).toBe('bun')
  })
  it('detects npm from package-lock.json', () => {
    touch('package-lock.json')
    expect(detectPackageManager(dir)).toBe('npm')
  })
  it('defaults to npm when no lockfile', () => {
    expect(detectPackageManager(dir)).toBe('npm')
  })
})
