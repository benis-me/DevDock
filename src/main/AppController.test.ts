import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { AppController } from './AppController'
import type { IFileWatcher } from './services/FileWatcher'

let dir: string
let configFile: string
let projDir: string

function fakeWatcher(): IFileWatcher {
  return { watch: vi.fn(), unwatch: vi.fn(), close: vi.fn() }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'devdock-ctrl-'))
  configFile = join(dir, 'config.json')
  projDir = join(dir, 'proj')
  mkdirSync(projDir, { recursive: true })
  writeFileSync(
    join(projDir, 'package.json'),
    JSON.stringify({ name: 'demo', scripts: { dev: 'vite', build: 'vite build' } })
  )
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('AppController', () => {
  it('adds a project from a path and scans scripts', () => {
    const c = new AppController(configFile, fakeWatcher())
    const p = c.addProjectFromPath(projDir)
    expect(p).not.toBeNull()
    expect(p!.name).toBe('demo')
    expect(p!.workspaces[0].scripts.map((s) => s.name).sort()).toEqual(['build', 'dev'])
    expect(c.listProjects()).toHaveLength(1)
  })

  it('persists projects across instances', () => {
    const c1 = new AppController(configFile, fakeWatcher())
    c1.addProjectFromPath(projDir)
    const c2 = new AppController(configFile, fakeWatcher())
    expect(c2.listProjects()).toHaveLength(1)
  })

  it('rescan returns diff with changed scripts', () => {
    const c = new AppController(configFile, fakeWatcher())
    const p = c.addProjectFromPath(projDir)!
    writeFileSync(
      join(projDir, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { dev: 'vite --host', test: 'vitest' } })
    )
    const { project, diff } = c.rescanProject(p.id)
    expect(project!.workspaces[0].scripts.map((s) => s.name).sort()).toEqual(['dev', 'test'])
    expect(diff.changed).toEqual(['.#dev'])
    expect(diff.added).toEqual(['.#test'])
    expect(diff.removed).toEqual(['.#build'])
  })

  it('marks project missing when path no longer exists', () => {
    const c = new AppController(configFile, fakeWatcher())
    const p = c.addProjectFromPath(projDir)!
    rmSync(projDir, { recursive: true, force: true })
    const { project } = c.rescanProject(p.id)
    expect(project!.missing).toBe(true)
  })

  it('returns default settings for a fresh config', () => {
    const c = new AppController(configFile, fakeWatcher())
    const s = c.getSettings()
    expect(s.terminalFontSize).toBe(12)
    expect(s.injectEnv).toBe(true)
    expect(s.confirmOnQuit).toBe(true)
    expect(s.portlessDefault).toBe(false)
  })

  it('merges and persists settings across instances', () => {
    const c1 = new AppController(configFile, fakeWatcher())
    const next = c1.setSettings({ terminalFontSize: 16, confirmOnQuit: false })
    expect(next.terminalFontSize).toBe(16)
    // 未涉及的字段保持默认
    expect(next.injectEnv).toBe(true)
    const c2 = new AppController(configFile, fakeWatcher())
    expect(c2.getSettings().terminalFontSize).toBe(16)
    expect(c2.getSettings().confirmOnQuit).toBe(false)
  })

  it('back-fills missing settings on legacy configs', () => {
    // 旧版本写入的、没有 settings / 缺字段的配置
    writeFileSync(
      configFile,
      JSON.stringify({
        version: 1,
        projects: [],
        ui: { theme: 'system' },
        scriptPrefs: {},
        settings: { terminalFontSize: 14 }
      })
    )
    const c = new AppController(configFile, fakeWatcher())
    const s = c.getSettings()
    expect(s.terminalFontSize).toBe(14) // 保留已有
    expect(s.injectEnv).toBe(true) // 回填默认
    expect(s.terminalCursorBlink).toBe(true)
  })
})
