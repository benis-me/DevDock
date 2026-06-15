import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { scanProject } from './Scanner'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'devdock-scan-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function writePkg(rel: string, json: object): void {
  const full = join(dir, rel)
  mkdirSync(full, { recursive: true })
  writeFileSync(join(full, 'package.json'), JSON.stringify(json))
}

describe('scanProject', () => {
  it('scans a single-package project', () => {
    writePkg('.', { name: 'app', scripts: { dev: 'vite', build: 'vite build' } })
    const r = scanProject(dir)
    expect(r.isMonorepo).toBe(false)
    expect(r.workspaces).toHaveLength(1)
    expect(r.workspaces[0].relPath).toBe('.')
    const ids = r.workspaces[0].scripts.map((s) => s.id).sort()
    expect(ids).toEqual(['.#build', '.#dev'])
    const dev = r.workspaces[0].scripts.find((s) => s.name === 'dev')!
    expect(dev.kind).toBe('long-running')
    expect(dev.cwd).toBe(dir)
  })

  it('detects npm/yarn workspaces glob', () => {
    writePkg('.', { name: 'root', private: true, workspaces: ['packages/*'] })
    writePkg('packages/web', { name: 'web', scripts: { dev: 'vite' } })
    writePkg('packages/api', { name: 'api', scripts: { start: 'node index.js' } })
    const r = scanProject(dir)
    expect(r.isMonorepo).toBe(true)
    const rels = r.workspaces.map((w) => w.relPath).sort()
    expect(rels).toEqual(['packages/api', 'packages/web'])
  })

  it('detects pnpm-workspace.yaml', () => {
    writePkg('.', { name: 'root', private: true })
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
    writePkg('apps/site', { name: 'site', scripts: { dev: 'astro dev' } })
    const r = scanProject(dir)
    expect(r.isMonorepo).toBe(true)
    expect(r.workspaces.map((w) => w.relPath)).toContain('apps/site')
  })
  it('includes monorepo root scripts when the root has scripts', () => {
    writePkg('.', { name: 'root', private: true, workspaces: ['packages/*'], scripts: { 'build:all': 'turbo run build' } })
    writePkg('packages/web', { name: 'web', scripts: { dev: 'vite' } })
    const r = scanProject(dir)
    expect(r.isMonorepo).toBe(true)
    const root = r.workspaces.find((w) => w.relPath === '.')
    expect(root?.scripts.map((s) => s.name)).toContain('build:all')
  })
})
