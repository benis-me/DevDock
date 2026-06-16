import { EventEmitter } from 'events'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { randomUUID } from 'crypto'
import { execSync } from 'child_process'
import { parse as parseDotenv } from 'dotenv'
import type { Config, Project, ScriptDef, ScriptPrefs, SessionState, Settings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { sessionKey, runCommand } from '@shared/util'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
import { ProjectStore } from './services/ProjectStore'
import { ProcessManager } from './services/ProcessManager'
import { PortService } from './services/PortService'
import { scanProject } from './services/Scanner'
import { diffScripts, type ScriptDiff } from './services/scriptDiff'
import type { IFileWatcher } from './services/FileWatcher'

export class AppController extends EventEmitter {
  private store: ProjectStore
  private config: Config
  private portlessOk = false
  readonly pm = new ProcessManager()
  private readonly ports = new PortService()

  constructor(
    configPath: string,
    private readonly watcher: IFileWatcher
  ) {
    super()
    this.store = new ProjectStore(configPath)
    this.config = this.store.load()
    if (!this.config.scriptPrefs) this.config.scriptPrefs = {}
    // 旧配置可能没有 settings，或缺少新增字段 —— 合并默认值
    this.config.settings = { ...DEFAULT_SETTINGS, ...this.config.settings }
    // 转发进程事件
    this.pm.on('data', (key, chunk) => this.emit('terminal:data', key, chunk))
    this.pm.on('status', (s: SessionState) => this.emit('session:status', s))
    this.pm.on('url', (key, url) => this.emit('session:url', key, url))
    this.pm.on('port:conflict', (key, port) => this.emit('port:conflict', key, port))
  }

  // ---- ports ----
  whoListens(port: number): Promise<import('@shared/types').PortProcess[]> {
    return this.ports.whoListens(port)
  }

  killPort(port: number): Promise<number[]> {
    return this.ports.killPort(port)
  }

  killPid(pid: number): Promise<boolean> {
    return this.ports.killPid(pid)
  }

  // ---- settings ----
  getSettings(): Settings {
    return this.config.settings
  }

  setSettings(partial: Partial<Settings>): Settings {
    this.config.settings = { ...this.config.settings, ...partial }
    this.persist()
    return this.config.settings
  }

  private persist(): void {
    this.store.save(this.config)
  }

  // ---- projects ----
  listProjects(): Project[] {
    return this.config.projects
  }

  startWatchingAll(): void {
    // 重扫每个项目以填充 envFiles（旧配置可能没有）并建立监听
    for (const p of this.config.projects) {
      if (!p.missing) this.rescanProject(p.id)
    }
  }

  addProjectFromPath(dirPath: string): Project | null {
    if (!existsSync(dirPath)) return null
    const existing = this.config.projects.find((p) => p.path === dirPath)
    if (existing) return existing
    const scanned = scanProject(dirPath)
    const project: Project = {
      id: randomUUID(),
      name: scanned.workspaces.find((w) => w.relPath === '.')?.name ?? basename(dirPath),
      path: dirPath,
      packageManager: scanned.packageManager,
      isMonorepo: scanned.isMonorepo,
      workspaces: scanned.workspaces,
      envFiles: scanned.envFiles,
      addedAt: Date.now()
    }
    this.config.projects.push(project)
    this.persist()
    this.watcher.watch(project)
    return project
  }

  removeProject(id: string): void {
    const p = this.getProject(id)
    if (p) for (const ws of p.workspaces) for (const s of ws.scripts) this.pm.stop(sessionKey(id, s.id))
    this.watcher.unwatch(id)
    this.config.projects = this.config.projects.filter((p) => p.id !== id)
    this.persist()
  }

  renameProject(id: string, name: string): void {
    const p = this.getProject(id)
    if (p) {
      p.name = name
      this.persist()
    }
  }

  reorderProjects(orderedIds: string[]): void {
    const byId = new Map(this.config.projects.map((p) => [p.id, p]))
    const next: Project[] = []
    for (const id of orderedIds) {
      const p = byId.get(id)
      if (p) next.push(p)
    }
    // 兜底：把未在排序列表里的项目补到末尾
    for (const p of this.config.projects) if (!orderedIds.includes(p.id)) next.push(p)
    this.config.projects = next
    this.persist()
  }

  setProjectPinned(id: string, pinned: boolean): void {
    const p = this.getProject(id)
    if (p) {
      p.pinned = pinned
      this.persist()
    }
  }

  relocateProject(id: string, newPath: string): Project | null {
    const p = this.getProject(id)
    if (!p) return null
    p.path = newPath
    p.missing = false
    this.persist()
    return this.rescanProject(id).project
  }

  rescanProject(id: string): { project: Project | null; diff: ScriptDiff } {
    const p = this.getProject(id)
    if (!p) return { project: null, diff: { added: [], removed: [], changed: [] } }
    if (!existsSync(p.path)) {
      p.missing = true
      this.persist()
      return { project: p, diff: { added: [], removed: [], changed: [] } }
    }
    p.missing = false
    const before = p.workspaces
    const scanned = scanProject(p.path)
    const diff = diffScripts(before, scanned.workspaces)
    p.workspaces = scanned.workspaces
    p.isMonorepo = scanned.isMonorepo
    p.packageManager = scanned.packageManager
    p.envFiles = scanned.envFiles
    this.persist()
    this.watcher.watch(p)
    return { project: p, diff }
  }

  // ---- env files ----
  readEnvFile(filePath: string): string {
    try {
      return readFileSync(filePath, 'utf8')
    } catch {
      return ''
    }
  }

  writeEnvFile(filePath: string, content: string): void {
    try {
      writeFileSync(filePath, content, 'utf8')
    } catch {
      /* ignore write failure */
    }
  }

  // ---- scripts ----
  private getProject(id: string): Project | undefined {
    return this.config.projects.find((p) => p.id === id)
  }

  private findScript(projectId: string, scriptId: string): { project: Project; def: ScriptDef } | null {
    const project = this.getProject(projectId)
    if (!project) return null
    for (const ws of project.workspaces) {
      const def = ws.scripts.find((s) => s.id === scriptId)
      if (def) return { project, def }
    }
    return null
  }

  startScript(projectId: string, scriptId: string): void {
    const found = this.findScript(projectId, scriptId)
    if (!found) return
    const { project, def } = found
    const base = def.runCmd ?? runCommand(project.packageManager, def.name)
    // 逐脚本设置优先；未设置时长任务回落到全局 portlessDefault。未安装 portless 时降级。
    const pref = this.config.scriptPrefs[sessionKey(projectId, scriptId)]?.portless
    const wantPortless =
      pref ?? (def.kind === 'long-running' && this.config.settings.portlessDefault)
    const usePortless = this.portlessOk && wantPortless

    let command = base
    let url: string | undefined
    if (usePortless) {
      const name = this.portlessName(project, def)
      command = `portless ${name} ${base}`
      url = `https://${name}.localhost`
    }

    this.pm.start({
      scriptId: sessionKey(projectId, scriptId),
      command,
      cwd: def.cwd,
      env: this.config.settings.injectEnv ? this.loadRunEnv(project.path, def.cwd) : {},
      url
    })
  }

  // portless 域名：dev → <项目>；其它服务 → <脚本>.<项目>
  private portlessName(project: Project, def: ScriptDef): string {
    const base = slugify(project.name) || slugify(basename(project.path)) || 'app'
    if (def.name === 'dev') return base
    return `${slugify(def.name) || 'svc'}.${base}`
  }

  // ---- script prefs (portless 等) ----
  getScriptPrefs(): Record<string, ScriptPrefs> {
    return this.config.scriptPrefs
  }

  setScriptPortless(projectId: string, scriptId: string, enabled: boolean): void {
    const key = sessionKey(projectId, scriptId)
    this.config.scriptPrefs[key] = { ...this.config.scriptPrefs[key], portless: enabled }
    this.persist()
  }

  // 启动时检测一次 portless 是否可用，结果缓存
  refreshPortlessAvailability(): boolean {
    try {
      execSync('command -v portless', {
        stdio: 'ignore',
        shell: process.env.SHELL || '/bin/bash'
      })
      this.portlessOk = true
    } catch {
      this.portlessOk = false
    }
    return this.portlessOk
  }

  isPortlessAvailable(): boolean {
    return this.portlessOk
  }

  // 把项目的 .env / .env.local 注入到脚本运行环境（先根目录后脚本目录，后者优先）
  private loadRunEnv(root: string, cwd: string): Record<string, string> {
    const merged: Record<string, string> = {}
    const files = [
      join(root, '.env'),
      join(root, '.env.local'),
      join(cwd, '.env'),
      join(cwd, '.env.local')
    ]
    const seen = new Set<string>()
    for (const f of files) {
      if (seen.has(f) || !existsSync(f)) continue
      seen.add(f)
      try {
        Object.assign(merged, parseDotenv(readFileSync(f)))
      } catch {
        /* ignore malformed env file */
      }
    }
    return merged
  }

  stopSession(key: string): void {
    this.pm.stop(key)
  }

  restartScript(projectId: string, scriptId: string): void {
    this.startScript(projectId, scriptId)
  }

  // ---- sessions / terminal ----
  listSessions(): SessionState[] {
    return this.pm.list()
  }
  writeTerminal(key: string, data: string): void {
    this.pm.write(key, data)
  }
  resizeTerminal(key: string, cols: number, rows: number): void {
    this.pm.resize(key, cols, rows)
  }
  getBuffer(key: string): string {
    return this.pm.getBuffer(key)
  }

  // ---- ui ----
  getUiState(): Config['ui'] {
    return this.config.ui
  }
  setUiState(partial: Partial<Config['ui']>): void {
    this.config.ui = { ...this.config.ui, ...partial }
    this.persist()
  }

  // ---- watch callback ----
  handleWatchChange(projectId: string, changedPath?: string): void {
    const { project, diff } = this.rescanProject(projectId)
    if (!project) return
    this.emit('project:updated', project)
    if (changedPath && /(^|[\\/])\.env(\..+)?$/.test(changedPath)) {
      this.emit('env:changed', changedPath)
    }
    const running = new Set(this.pm.list().map((s) => s.scriptId))
    for (const id of [...diff.changed, ...diff.removed]) {
      const key = sessionKey(projectId, id)
      if (running.has(key)) this.emit('script:changed', key)
    }
  }

  shutdown(): void {
    this.watcher.close()
    this.pm.killAll()
  }
}
