import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ProjectStore } from './ProjectStore'
import { DEFAULT_CONFIG } from '@shared/types'

let dir: string
let file: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'devdock-store-'))
  file = join(dir, 'config.json')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('ProjectStore', () => {
  it('returns default config when file is missing', () => {
    const store = new ProjectStore(file)
    expect(store.load()).toEqual(DEFAULT_CONFIG)
  })

  it('persists and reloads config', () => {
    const store = new ProjectStore(file)
    const cfg = store.load()
    cfg.ui.theme = 'dark'
    store.save(cfg)
    const store2 = new ProjectStore(file)
    expect(store2.load().ui.theme).toBe('dark')
  })

  it('creates parent directory on save', () => {
    const nested = join(dir, 'a', 'b', 'config.json')
    const store = new ProjectStore(nested)
    store.save(store.load())
    expect(existsSync(nested)).toBe(true)
  })

  it('backs up and resets on corrupt json', () => {
    writeFileSync(file, '{ not json')
    const store = new ProjectStore(file)
    expect(store.load()).toEqual(DEFAULT_CONFIG)
    expect(existsSync(file + '.bak')).toBe(true)
  })
})
