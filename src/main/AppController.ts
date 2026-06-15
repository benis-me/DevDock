import { EventEmitter } from 'events'
import { existsSync } from 'fs'
import { basename } from 'path'
import { randomUUID } from 'crypto'
import type { Config, Project, ScriptDef, SessionState } from '@shared/types'
import { sessionKey, runCommand } from '@shared/util'
import { ProjectStore } from './services/ProjectStore'
import { ProcessManager } from './services/ProcessManager'
import { scanProject } from './services/Scanner'
import { diffScripts, type ScriptDiff } from './services/scriptDiff'
import type { IFileWatcher } from './services/FileWatcher'

export class AppController extends EventEmitter {
  private store: ProjectStore
  private config: Config
  readonly pm = new ProcessManager()

  constructor(
    configPath: string,
    private readonly watcher: IFileWatcher
  ) {
    super()
    this.store = new ProjectStore(configPath)
    this.config = this.store.load()
    // 转发进程事件
    this.pm.on('data', (key, chunk) => this.emit('terminal:data', key, chunk))
    this.pm.on('status', (s: SessionState) => this.emit('session:status', s))
    this.pm.on('url', (key, url) => this.emit('session:url', key, url))
  }

  private persist(): void {
    this.store.save(this.config)
  }

  // ---- projects ----
  listProjects(): Project[] {
    return this.config.projects
  }

  startWatchingAll(): void {
    for (const p of this.config.projects) if (!p.missing) this.watcher.watch(p)
  }

  addProjectFromPath(dirPath: string): Project | null {
    if (!existsSync(dirPath)) return null
    const scanned = scanProject(dirPath)
    const project: Project = {
      id: randomUUID(),
      name: scanned.workspaces.find((w) => w.relPath === '.')?.name ?? basename(dirPath),
      path: dirPath,
      packageManager: scanned.packageManager,
      isMonorepo: scanned.isMonorepo,
      workspaces: scanned.workspaces,
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
    this.persist()
    this.watcher.watch(p)
    return { project: p, diff }
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
    this.pm.start({
      scriptId: sessionKey(projectId, scriptId),
      command: runCommand(project.packageManager, def.name),
      cwd: def.cwd
    })
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
  handleWatchChange(projectId: string): void {
    const { project, diff } = this.rescanProject(projectId)
    if (!project) return
    this.emit('project:updated', project)
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
