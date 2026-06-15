import { existsSync, readFileSync } from 'fs'
import { dirname, join, relative, sep } from 'path'
import fg from 'fast-glob'
import yaml from 'js-yaml'
import type { PackageManager, ScriptDef, ScriptKind, WorkspacePkg } from '@shared/types'

export function detectPackageManager(dir: string): PackageManager {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn'
  // bun 1.2+ 用文本 bun.lock；旧版用二进制 bun.lockb，两者都要识别
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun'
  if (existsSync(join(dir, 'package-lock.json'))) return 'npm'
  return 'npm'
}

const LONG_RUNNING_NAME = /^(dev|start|serve|watch|preview)(:|$)/i
const LONG_RUNNING_CMD =
  /(vite(?!st)(?!\s+build)|next\s+dev|nuxt\s+dev|webpack(\s+serve|-dev-server)|react-scripts\s+start|vue-cli-service\s+serve|astro\s+dev|remix\s+dev|nodemon|tsc\s+-w|--watch)/i

export function classifyScript(name: string, command: string): ScriptKind {
  if (LONG_RUNNING_NAME.test(name)) return 'long-running'
  if (LONG_RUNNING_CMD.test(command)) return 'long-running'
  return 'one-shot'
}

export interface ScannedProject {
  isMonorepo: boolean
  packageManager: PackageManager
  workspaces: WorkspacePkg[]
}

function readJson(file: string): any {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function toRel(root: string, full: string): string {
  const r = relative(root, full).split(sep).join('/')
  return r === '' ? '.' : r
}

function buildWorkspace(root: string, pkgJsonPath: string): WorkspacePkg | null {
  const pkg = readJson(pkgJsonPath)
  if (!pkg) return null
  const cwd = dirname(pkgJsonPath)
  const relPath = toRel(root, cwd)
  const scriptsObj: Record<string, string> = pkg.scripts ?? {}
  const scripts: ScriptDef[] = Object.entries(scriptsObj).map(([name, command]) => ({
    id: `${relPath}#${name}`,
    name,
    command,
    kind: classifyScript(name, command),
    cwd
  }))
  return { name: pkg.name ?? relPath, relPath, scripts }
}

function readWorkspacePatterns(root: string): string[] {
  const patterns: string[] = []
  const rootPkg = readJson(join(root, 'package.json'))
  if (rootPkg?.workspaces) {
    const ws = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces.packages
    if (Array.isArray(ws)) patterns.push(...ws)
  }
  const pnpmFile = join(root, 'pnpm-workspace.yaml')
  if (existsSync(pnpmFile)) {
    try {
      const parsed = yaml.load(readFileSync(pnpmFile, 'utf8')) as { packages?: string[] }
      if (Array.isArray(parsed?.packages)) patterns.push(...parsed.packages)
    } catch {
      /* ignore malformed yaml */
    }
  }
  return patterns
}

export function scanProject(root: string): ScannedProject {
  const packageManager = detectPackageManager(root)
  const patterns = readWorkspacePatterns(root)
  const isMonorepo = patterns.length > 0
  const workspaces: WorkspacePkg[] = []

  const rootWs = buildWorkspace(root, join(root, 'package.json'))

  if (isMonorepo) {
    const pkgGlobs = patterns.map((p) => `${p.replace(/\/$/, '')}/package.json`)
    const found = fg.sync(pkgGlobs, {
      cwd: root,
      absolute: true,
      ignore: ['**/node_modules/**'],
      onlyFiles: true
    })
    for (const f of found) {
      const ws = buildWorkspace(root, f)
      if (ws) workspaces.push(ws)
    }
    workspaces.sort((a, b) => a.relPath.localeCompare(b.relPath))
  } else if (rootWs) {
    workspaces.push(rootWs)
  }

  return { isMonorepo, packageManager, workspaces }
}
