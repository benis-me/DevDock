import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { scanProject } from './Scanner'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'devdock-scan-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function writePkg(rel: string, json: object): void {
  const full = join(dir, rel)
  mkdirSync(full, { recursive: true })
  writeFileSync(join(full, 'package.json'), JSON.stringify(json))
}

describe('scanProject', () => {
  it('scans a single-package project', async () => {
    writePkg('.', { name: 'app', scripts: { dev: 'vite', build: 'vite build' } })
    const r = await scanProject(dir)
    expect(r.isMonorepo).toBe(false)
    expect(r.workspaces).toHaveLength(1)
    expect(r.workspaces[0].relPath).toBe('.')
    const ids = r.workspaces[0].scripts.map((s) => s.id).sort()
    expect(ids).toEqual(['.#build', '.#dev'])
    const dev = r.workspaces[0].scripts.find((s) => s.name === 'dev')!
    expect(dev.kind).toBe('long-running')
    expect(dev.cwd).toBe(dir)
  })

  it('detects npm/yarn workspaces glob', async () => {
    writePkg('.', { name: 'root', private: true, workspaces: ['packages/*'] })
    writePkg('packages/web', { name: 'web', scripts: { dev: 'vite' } })
    writePkg('packages/api', { name: 'api', scripts: { start: 'node index.js' } })
    const r = await scanProject(dir)
    expect(r.isMonorepo).toBe(true)
    const rels = r.workspaces.map((w) => w.relPath).sort()
    expect(rels).toEqual(['packages/api', 'packages/web'])
  })

  it('detects pnpm-workspace.yaml', async () => {
    writePkg('.', { name: 'root', private: true })
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
    writePkg('apps/site', { name: 'site', scripts: { dev: 'astro dev' } })
    const r = await scanProject(dir)
    expect(r.isMonorepo).toBe(true)
    expect(r.workspaces.map((w) => w.relPath)).toContain('apps/site')
  })

  it('includes monorepo root scripts when the root has scripts', async () => {
    writePkg('.', {
      name: 'root',
      private: true,
      workspaces: ['packages/*'],
      scripts: { 'build:all': 'turbo run build' }
    })
    writePkg('packages/web', { name: 'web', scripts: { dev: 'vite' } })
    const r = await scanProject(dir)
    expect(r.isMonorepo).toBe(true)
    const root = r.workspaces.find((w) => w.relPath === '.')
    expect(root?.scripts.map((s) => s.name)).toContain('build:all')
  })

  it('detects non-npm scripts (Makefile + Cargo) on the root workspace', async () => {
    writePkg('.', { name: 'app', scripts: { dev: 'vite' } })
    writeFileSync(join(dir, 'Makefile'), '.PHONY: build\nbuild:\n\tgo build\ntest:\n\tgo test\n')
    writeFileSync(join(dir, 'Cargo.toml'), '[package]\nname = "x"\n')
    const r = await scanProject(dir)
    const root = r.workspaces.find((w) => w.relPath === '.')!
    const ids = root.scripts.map((s) => s.id)
    expect(ids).toContain('.#make:build')
    expect(ids).toContain('.#cargo:run')
    expect(root.scripts.find((s) => s.id === '.#cargo:run')?.runCmd).toBe('cargo run')
  })

  it('detects a project with no package.json (Makefile only)', async () => {
    writeFileSync(join(dir, 'Makefile'), 'deploy:\n\t./deploy.sh\n')
    const r = await scanProject(dir)
    const root = r.workspaces.find((w) => w.relPath === '.')
    expect(root?.scripts.map((s) => s.name)).toContain('deploy')
  })
})

describe('project type detection', () => {
  it('detects an Xcode project by .xcodeproj', async () => {
    mkdirSync(join(dir, 'MyApp.xcodeproj'), { recursive: true })
    expect((await scanProject(dir)).type).toBe('Xcode')
  })

  it('detects a Swift package by Package.swift', async () => {
    writeFileSync(join(dir, 'Package.swift'), '// swift-tools-version:5.9\n')
    expect((await scanProject(dir)).type).toBe('Swift')
  })

  it('detects a Unity project by Assets + ProjectSettings', async () => {
    mkdirSync(join(dir, 'Assets'), { recursive: true })
    mkdirSync(join(dir, 'ProjectSettings'), { recursive: true })
    expect((await scanProject(dir)).type).toBe('Unity')
  })

  it('detects Go / Flutter / Python by manifest files', async () => {
    const go = mkdtempSync(join(tmpdir(), 'devdock-go-'))
    writeFileSync(join(go, 'go.mod'), 'module x\n')
    expect((await scanProject(go)).type).toBe('Go')
    rmSync(go, { recursive: true, force: true })

    const fl = mkdtempSync(join(tmpdir(), 'devdock-fl-'))
    writeFileSync(join(fl, 'pubspec.yaml'), 'name: x\n')
    expect((await scanProject(fl)).type).toBe('Flutter')
    rmSync(fl, { recursive: true, force: true })

    const py = mkdtempSync(join(tmpdir(), 'devdock-py-'))
    writeFileSync(join(py, 'pyproject.toml'), '[project]\nname="x"\n')
    expect((await scanProject(py)).type).toBe('Python')
    rmSync(py, { recursive: true, force: true })
  })

  it('detects a frontend framework from scripts (Vite)', async () => {
    writePkg('.', { name: 'app', scripts: { dev: 'vite', build: 'vite build' } })
    expect((await scanProject(dir)).type).toBe('Vite')
  })

  it('falls back to the package manager for a plain node project', async () => {
    writePkg('.', { name: 'app', scripts: { start: 'node index.js' } })
    expect((await scanProject(dir)).type).toBe('npm')
  })

  it('returns undefined for an empty directory', async () => {
    expect((await scanProject(dir)).type).toBeUndefined()
  })
})
