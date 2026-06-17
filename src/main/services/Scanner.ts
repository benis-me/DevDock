import { existsSync } from 'fs'
import { readFile, readdir } from 'fs/promises'
import { basename, dirname, join, relative, sep } from 'path'
import fg from 'fast-glob'
import yaml from 'js-yaml'
import type { EnvFile, PackageManager, ScriptDef, ScriptKind, WorkspacePkg } from '@shared/types'

const ENV_FILE = /^\.env(\..+)?$/

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
  /(vite(?!st)\b|next\s+dev|nuxt\s+dev|webpack(\s+serve|-dev-server)|react-scripts\s+start|vue-cli-service\s+serve|astro\s+dev|remix\s+dev|nodemon|tsc\s+-w|--watch)/i

export function classifyScript(name: string, command: string): ScriptKind {
  if (LONG_RUNNING_NAME.test(name)) return 'long-running'
  // 命令含独立 build 且非 watch → 一次性（避免 "vite --config x build" 被误判）
  if (/\bbuild\b/.test(command) && !/(--watch|(^|\s)-w(\s|$))/.test(command)) return 'one-shot'
  if (LONG_RUNNING_CMD.test(command)) return 'long-running'
  return 'one-shot'
}

export interface ScannedProject {
  isMonorepo: boolean
  packageManager: PackageManager
  workspaces: WorkspacePkg[]
  envFiles: EnvFile[]
  type?: string
}

// 推断项目类型用于显示图标。先看特征文件/目录（iOS/Unity 等脚本里看不出来的），
// 再看脚本命令里的前端框架，最后回退到语言/包管理器。
export async function detectProjectType(
  root: string,
  workspaces: WorkspacePkg[],
  packageManager: PackageManager
): Promise<string | undefined> {
  let entries: string[] = []
  try {
    entries = await readdir(root)
  } catch {
    /* ignore */
  }
  const has = (f: string): boolean => existsSync(join(root, f))
  const anyEnds = (...exts: string[]): boolean =>
    entries.some((e) => exts.some((ext) => e.endsWith(ext)))

  // 文件/目录特征（与前端框架基本不共存的平台）
  if (anyEnds('.xcodeproj', '.xcworkspace')) return 'Xcode'
  if (has('Package.swift')) return 'Swift'
  if (has('Assets') && has('ProjectSettings')) return 'Unity'
  if (has('pubspec.yaml')) return 'Flutter'
  if (anyEnds('.sln', '.csproj', '.fsproj')) return '.NET'
  if (has('build.gradle') || has('build.gradle.kts') || has('pom.xml')) return 'JVM'

  // 脚本命令里的前端框架
  const text = workspaces.flatMap((w) => w.scripts.map((s) => s.command.toLowerCase())).join('\n')
  const cmd = (re: RegExp): boolean => re.test(text)
  if (cmd(/\bnext\s+(dev|build|start)/)) return 'Next.js'
  if (cmd(/\bnuxt\b/)) return 'Nuxt'
  if (cmd(/\bastro\b/)) return 'Astro'
  if (cmd(/\bremix\b/)) return 'Remix'
  if (cmd(/\bexpo\b/)) return 'Expo'
  if (cmd(/\belectron(-vite)?\b/)) return 'Electron'
  if (cmd(/react-scripts/)) return 'CRA'
  if (cmd(/vue-cli-service/)) return 'Vue'
  if (cmd(/sveltekit|svelte-kit|\bsvelte\b/)) return 'Svelte'
  if (cmd(/@angular|(^|\s)ng\s/)) return 'Angular'
  if (cmd(/\bvite(?!st)\b/)) return 'Vite'

  // 其它语言/运行时（可能与 JS 共存的放在框架判断之后）
  if (has('go.mod')) return 'Go'
  if (has('Cargo.toml')) return 'Rust'
  if (has('pyproject.toml') || has('requirements.txt') || has('setup.py') || has('Pipfile'))
    return 'Python'
  if (has('deno.json') || has('deno.jsonc')) return 'Deno'

  const sources = new Set(workspaces.flatMap((w) => w.scripts.map((s) => s.source)))
  if (sources.has('compose')) return 'Docker'
  if (has('package.json')) return packageManager
  if (sources.has('make')) return 'Make'
  return undefined
}

async function scanEnvFiles(root: string, dirs: string[]): Promise<EnvFile[]> {
  const out: EnvFile[] = []
  const seen = new Set<string>()
  for (const dir of dirs) {
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (!ENV_FILE.test(name)) continue
      const full = join(dir, name)
      if (seen.has(full)) continue
      seen.add(full)
      out.push({ name, relPath: toRel(root, dir), path: full })
    }
  }
  out.sort((a, b) =>
    a.relPath === b.relPath ? a.name.localeCompare(b.name) : a.relPath.localeCompare(b.relPath)
  )
  return out
}

async function readJson(file: string): Promise<any> {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return null
  }
}

function toRel(root: string, full: string): string {
  const r = relative(root, full).split(sep).join('/')
  return r === '' ? '.' : r
}

async function buildWorkspace(root: string, pkgJsonPath: string): Promise<WorkspacePkg | null> {
  const pkg = await readJson(pkgJsonPath)
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

async function readWorkspacePatterns(root: string): Promise<string[]> {
  const patterns: string[] = []
  const rootPkg = await readJson(join(root, 'package.json'))
  if (rootPkg?.workspaces) {
    const ws = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces.packages
    if (Array.isArray(ws)) patterns.push(...ws)
  }
  const pnpmFile = join(root, 'pnpm-workspace.yaml')
  if (existsSync(pnpmFile)) {
    try {
      const parsed = yaml.load(await readFile(pnpmFile, 'utf8')) as { packages?: string[] }
      if (Array.isArray(parsed?.packages)) patterns.push(...parsed.packages)
    } catch {
      /* ignore malformed yaml */
    }
  }
  return patterns
}

// 非 npm 的可运行脚本来源：Makefile / docker-compose / Procfile / Cargo / justfile / deno
async function detectExtraScripts(root: string): Promise<ScriptDef[]> {
  const out: ScriptDef[] = []
  const add = (source: string, name: string, runCmd: string, kind?: ScriptKind): void => {
    out.push({
      id: `.#${source}:${name}`,
      name,
      command: runCmd,
      kind: kind ?? classifyScript(name, runCmd),
      cwd: root,
      source,
      runCmd
    })
  }
  const read = async (f: string): Promise<string | null> => {
    try {
      return await readFile(join(root, f), 'utf8')
    } catch {
      return null
    }
  }
  const firstExisting = (names: string[]): string | null =>
    names.find((f) => existsSync(join(root, f))) ?? null

  // Makefile targets
  const mk = firstExisting(['Makefile', 'makefile', 'GNUmakefile'])
  if (mk) {
    const text = (await read(mk)) ?? ''
    const targets = new Set<string>()
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9][\w.-]*)\s*:(?!=)/)
      if (m && !m[1].startsWith('.')) targets.add(m[1])
    }
    for (const t of [...targets].slice(0, 50)) add('make', t, `make ${t}`)
  }

  // docker compose services
  const compose = firstExisting([
    'compose.yaml',
    'compose.yml',
    'docker-compose.yml',
    'docker-compose.yaml'
  ])
  if (compose) {
    try {
      const doc = yaml.load((await read(compose)) ?? '') as { services?: Record<string, unknown> }
      for (const svc of Object.keys(doc?.services ?? {}))
        add('compose', svc, `docker compose up ${svc}`, 'long-running')
    } catch {
      /* ignore */
    }
  }

  // Procfile
  const proc = await read('Procfile')
  if (proc !== null) {
    for (const line of proc.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/)
      if (m) add('procfile', m[1], m[2].trim(), 'long-running')
    }
  }

  // Cargo
  if (existsSync(join(root, 'Cargo.toml'))) {
    add('cargo', 'run', 'cargo run', 'long-running')
    add('cargo', 'build', 'cargo build', 'one-shot')
    add('cargo', 'test', 'cargo test', 'one-shot')
  }

  // justfile recipes
  const just = firstExisting(['justfile', 'Justfile', '.justfile'])
  if (just) {
    for (const line of ((await read(just)) ?? '').split(/\r?\n/)) {
      const m = line.match(/^([a-zA-Z0-9_-]+)(?:\s+[a-zA-Z0-9_]+)*\s*:(?!=)/)
      if (m && m[1] !== 'set') add('just', m[1], `just ${m[1]}`)
    }
  }

  // deno tasks
  const deno = firstExisting(['deno.json', 'deno.jsonc'])
  if (deno) {
    try {
      const raw = ((await read(deno)) ?? '').replace(/^\s*\/\/.*$/gm, '')
      const cfg = JSON.parse(raw) as { tasks?: Record<string, string> }
      for (const t of Object.keys(cfg?.tasks ?? {})) add('deno', t, `deno task ${t}`)
    } catch {
      /* ignore */
    }
  }

  const seen = new Set<string>()
  return out.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
}

export async function scanProject(root: string): Promise<ScannedProject> {
  const packageManager = detectPackageManager(root)
  const patterns = await readWorkspacePatterns(root)
  const isMonorepo = patterns.length > 0
  const workspaces: WorkspacePkg[] = []

  const rootWs = await buildWorkspace(root, join(root, 'package.json'))

  if (isMonorepo) {
    // monorepo 根包自身的脚本（如 build:all/release）也要纳入
    if (rootWs && rootWs.scripts.length > 0) workspaces.push(rootWs)
    const pkgGlobs = patterns.map((p) => `${p.replace(/\/$/, '')}/package.json`)
    const found = await fg(pkgGlobs, {
      cwd: root,
      absolute: true,
      ignore: ['**/node_modules/**'],
      onlyFiles: true
    })
    const built = await Promise.all(found.map((f) => buildWorkspace(root, f)))
    for (const ws of built) if (ws) workspaces.push(ws)
    workspaces.sort((a, b) => a.relPath.localeCompare(b.relPath))
  } else if (rootWs) {
    workspaces.push(rootWs)
  }

  // 非 npm 脚本（Makefile/compose/Procfile/cargo/just/deno）挂到根 workspace
  const extra = await detectExtraScripts(root)
  if (extra.length > 0) {
    let rootWsRef = workspaces.find((w) => w.relPath === '.')
    if (!rootWsRef) {
      rootWsRef = { name: rootWs?.name ?? basename(root), relPath: '.', scripts: [] }
      workspaces.unshift(rootWsRef)
    }
    rootWsRef.scripts = [...rootWsRef.scripts, ...extra]
  }

  // .env 文件：扫描项目根目录 + 每个 workspace 目录
  const envDirs = new Set<string>([root])
  for (const ws of workspaces) envDirs.add(ws.relPath === '.' ? root : join(root, ws.relPath))
  const envFiles = await scanEnvFiles(root, [...envDirs])

  const type = await detectProjectType(root, workspaces, packageManager)

  return { isMonorepo, packageManager, workspaces, envFiles, type }
}
