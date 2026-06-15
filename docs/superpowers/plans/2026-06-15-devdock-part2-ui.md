# DevDock 实现计划 Part 2 — 集成与 UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Part 1 的服务之上接入 IPC/preload，实现 Zustand 状态、三栏界面、xterm 终端、文件监听自动重扫与退出处理，产出完整可用的 DevDock。

**Architecture:** AppController 在主进程编排 ProjectStore / ProcessManager / FileWatcher，并通过依赖注入保持可单测（configPath、watcher 注入，不在模块顶层 import electron）。IPC 层负责 electron 对话框与事件转发。渲染层用 Zustand 镜像状态，终端数据绕过 store 直达 xterm。

**Tech Stack:** Electron IPC（contextBridge）、Zustand、@xterm/xterm、chokidar。

**前置:** Part 1 已完成（服务与脚手架就绪）。

**全局 sessionKey 约定:** ScriptDef.id 仅在项目内唯一（`${relPath}#${name}`）。跨项目运行态用 `sessionKey = \`${projectId}::${scriptId}\`` 作为 ProcessManager 与所有 session 事件的键。

---

### Task 1: AppController 编排层（DI，可单测）

**Files:**
- Create: `src/shared/util.ts`, `src/main/services/FileWatcher.ts`, `src/main/AppController.ts`
- Test: `src/main/AppController.test.ts`

- [ ] **Step 1: 写 sessionKey / runCommand 工具与失败测试**

`src/shared/util.ts`:
```ts
import type { PackageManager } from './types'

export function sessionKey(projectId: string, scriptId: string): string {
  return `${projectId}::${scriptId}`
}

export function runCommand(pm: PackageManager, scriptName: string): string {
  switch (pm) {
    case 'yarn':
      return `yarn ${scriptName}`
    case 'pnpm':
      return `pnpm run ${scriptName}`
    case 'bun':
      return `bun run ${scriptName}`
    default:
      return `npm run ${scriptName}`
  }
}
```

`src/main/AppController.test.ts`:
```ts
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
})
```

- [ ] **Step 2: 写 FileWatcher（含接口，便于注入）**

`src/main/services/FileWatcher.ts`:
```ts
import chokidar, { type FSWatcher } from 'chokidar'
import type { Project } from '@shared/types'

export interface IFileWatcher {
  watch(project: Project): void
  unwatch(projectId: string): void
  close(): void
}

const WATCH_NAMES = /(^|[\\/])(package\.json|pnpm-workspace\.yaml)$/

export class FileWatcher implements IFileWatcher {
  private watchers = new Map<string, FSWatcher>()
  private timers = new Map<string, NodeJS.Timeout>()

  constructor(private readonly onChange: (projectId: string) => void) {}

  watch(project: Project): void {
    this.unwatch(project.id)
    const w = chokidar.watch(project.path, {
      ignored: (p: string) => p.includes('node_modules') || p.includes('.git'),
      ignoreInitial: true,
      depth: 4
    })
    const handler = (p: string): void => {
      if (!WATCH_NAMES.test(p)) return
      const existing = this.timers.get(project.id)
      if (existing) clearTimeout(existing)
      this.timers.set(
        project.id,
        setTimeout(() => this.onChange(project.id), 300)
      )
    }
    w.on('add', handler).on('change', handler).on('unlink', handler)
    this.watchers.set(project.id, w)
  }

  unwatch(projectId: string): void {
    this.watchers.get(projectId)?.close()
    this.watchers.delete(projectId)
    const t = this.timers.get(projectId)
    if (t) clearTimeout(t)
    this.timers.delete(projectId)
  }

  close(): void {
    for (const w of this.watchers.values()) w.close()
    this.watchers.clear()
    this.timers.clear()
  }
}
```

- [ ] **Step 3: 安装 chokidar 并运行测试确认失败**

```bash
bun add chokidar
```
Run: `bunx vitest run src/main/AppController.test.ts`
Expected: FAIL（`AppController` 未定义）。

- [ ] **Step 4: 实现 AppController**

`src/main/AppController.ts`:
```ts
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `bunx vitest run src/main/AppController.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add AppController orchestration with file watcher (DI)"
```

---

### Task 2: IPC 注册 + preload + API 类型

**Files:**
- Create: `src/shared/api.ts`, `src/main/ipc/registerIpc.ts`
- Modify: `src/main/index.ts`, `src/preload/index.ts`

- [ ] **Step 1: 定义 API 类型**

`src/shared/api.ts`:
```ts
import type { Project, SessionState, UiState } from './types'

export interface DevDockApi {
  projects: {
    list(): Promise<Project[]>
    add(): Promise<Project | null>
    remove(id: string): Promise<void>
    rename(id: string, name: string): Promise<void>
    rescan(id: string): Promise<Project | null>
    relocate(id: string): Promise<Project | null>
  }
  scripts: {
    start(projectId: string, scriptId: string): Promise<void>
    stop(sessionKey: string): Promise<void>
    restart(projectId: string, scriptId: string): Promise<void>
  }
  terminal: {
    write(sessionKey: string, data: string): Promise<void>
    resize(sessionKey: string, cols: number, rows: number): Promise<void>
    getBuffer(sessionKey: string): Promise<string>
  }
  shell: {
    openExternal(url: string): Promise<void>
    revealInFinder(path: string): Promise<void>
  }
  ui: {
    getState(): Promise<UiState>
    setState(partial: Partial<UiState>): Promise<void>
  }
  sessions: { list(): Promise<SessionState[]> }
  onTerminalData(cb: (sessionKey: string, chunk: string) => void): () => void
  onSessionStatus(cb: (state: SessionState) => void): () => void
  onSessionUrl(cb: (sessionKey: string, url: string) => void): () => void
  onProjectUpdated(cb: (project: Project) => void): () => void
  onScriptChanged(cb: (sessionKey: string) => void): () => void
}

declare global {
  interface Window {
    devdock: DevDockApi
  }
}
```

- [ ] **Step 2: 实现 IPC 注册（含 dialog 与事件转发）**

`src/main/ipc/registerIpc.ts`:
```ts
import { ipcMain, dialog, shell, nativeTheme, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { AppController } from '../AppController'

export function registerIpc(controller: AppController, getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, ...args: unknown[]): void => {
    getWindow()?.webContents.send(channel, ...args)
  }

  controller.on('terminal:data', (key, chunk) => send(IPC.EvtTerminalData, key, chunk))
  controller.on('session:status', (s) => send(IPC.EvtSessionStatus, s))
  controller.on('session:url', (key, url) => send(IPC.EvtSessionUrl, key, url))
  controller.on('project:updated', (p) => send(IPC.EvtProjectUpdated, p))
  controller.on('script:changed', (key) => send(IPC.EvtScriptChanged, key))

  ipcMain.handle(IPC.ProjectsList, () => controller.listProjects())
  ipcMain.handle(IPC.ProjectsAdd, async () => {
    const win = getWindow()
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    if (res.canceled || !res.filePaths[0]) return null
    return controller.addProjectFromPath(res.filePaths[0])
  })
  ipcMain.handle(IPC.ProjectsRemove, (_e, id: string) => controller.removeProject(id))
  ipcMain.handle(IPC.ProjectsRename, (_e, id: string, name: string) => controller.renameProject(id, name))
  ipcMain.handle(IPC.ProjectsRescan, (_e, id: string) => controller.rescanProject(id).project)
  ipcMain.handle(IPC.ProjectsRelocate, async (_e, id: string) => {
    const win = getWindow()
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    if (res.canceled || !res.filePaths[0]) return null
    return controller.relocateProject(id, res.filePaths[0])
  })

  ipcMain.handle(IPC.ScriptsStart, (_e, pid: string, sid: string) => controller.startScript(pid, sid))
  ipcMain.handle(IPC.ScriptsStop, (_e, key: string) => controller.stopSession(key))
  ipcMain.handle(IPC.ScriptsRestart, (_e, pid: string, sid: string) => controller.restartScript(pid, sid))

  ipcMain.handle(IPC.TerminalWrite, (_e, key: string, data: string) => controller.writeTerminal(key, data))
  ipcMain.handle(IPC.TerminalResize, (_e, key: string, c: number, r: number) =>
    controller.resizeTerminal(key, c, r)
  )
  ipcMain.handle(IPC.TerminalGetBuffer, (_e, key: string) => controller.getBuffer(key))

  ipcMain.handle(IPC.ShellOpenExternal, (_e, url: string) => shell.openExternal(url))
  ipcMain.handle(IPC.ShellRevealInFinder, (_e, p: string) => shell.showItemInFolder(p))

  ipcMain.handle(IPC.UiGetState, () => controller.getUiState())
  ipcMain.handle(IPC.UiSetState, (_e, partial) => {
    controller.setUiState(partial)
    if (partial.theme) nativeTheme.themeSource = partial.theme
  })
  ipcMain.handle(IPC.SessionsList, () => controller.listSessions())
}
```

- [ ] **Step 3: 实现 preload**

`src/preload/index.ts`:
```ts
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { DevDockApi } from '@shared/api'

function sub(channel: string, cb: (...args: any[]) => void): () => void {
  const listener = (_e: unknown, ...args: any[]): void => cb(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: DevDockApi = {
  projects: {
    list: () => ipcRenderer.invoke(IPC.ProjectsList),
    add: () => ipcRenderer.invoke(IPC.ProjectsAdd),
    remove: (id) => ipcRenderer.invoke(IPC.ProjectsRemove, id),
    rename: (id, name) => ipcRenderer.invoke(IPC.ProjectsRename, id, name),
    rescan: (id) => ipcRenderer.invoke(IPC.ProjectsRescan, id),
    relocate: (id) => ipcRenderer.invoke(IPC.ProjectsRelocate, id)
  },
  scripts: {
    start: (pid, sid) => ipcRenderer.invoke(IPC.ScriptsStart, pid, sid),
    stop: (key) => ipcRenderer.invoke(IPC.ScriptsStop, key),
    restart: (pid, sid) => ipcRenderer.invoke(IPC.ScriptsRestart, pid, sid)
  },
  terminal: {
    write: (key, data) => ipcRenderer.invoke(IPC.TerminalWrite, key, data),
    resize: (key, c, r) => ipcRenderer.invoke(IPC.TerminalResize, key, c, r),
    getBuffer: (key) => ipcRenderer.invoke(IPC.TerminalGetBuffer, key)
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke(IPC.ShellOpenExternal, url),
    revealInFinder: (p) => ipcRenderer.invoke(IPC.ShellRevealInFinder, p)
  },
  ui: {
    getState: () => ipcRenderer.invoke(IPC.UiGetState),
    setState: (partial) => ipcRenderer.invoke(IPC.UiSetState, partial)
  },
  sessions: { list: () => ipcRenderer.invoke(IPC.SessionsList) },
  onTerminalData: (cb) => sub(IPC.EvtTerminalData, cb),
  onSessionStatus: (cb) => sub(IPC.EvtSessionStatus, cb),
  onSessionUrl: (cb) => sub(IPC.EvtSessionUrl, cb),
  onProjectUpdated: (cb) => sub(IPC.EvtProjectUpdated, cb),
  onScriptChanged: (cb) => sub(IPC.EvtScriptChanged, cb)
}

contextBridge.exposeInMainWorld('devdock', api)
```

- [ ] **Step 4: 接入 main/index.ts（实例化 controller + watcher + ipc + 退出占位）**

替换 `src/main/index.ts` 内容：
```ts
import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { AppController } from './AppController'
import { FileWatcher } from './services/FileWatcher'
import { registerIpc } from './ipc/registerIpc'

let mainWindow: BrowserWindow | null = null
let controller: AppController

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const configPath = join(app.getPath('userData'), 'devdock', 'config.json')
  const watcher = new FileWatcher((id) => controller.handleWatchChange(id))
  controller = new AppController(configPath, watcher)
  nativeTheme.themeSource = controller.getUiState().theme
  controller.startWatchingAll()
  registerIpc(controller, () => mainWindow)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  controller?.shutdown()
})
```

- [ ] **Step 5: 验证应用仍能启动 + 全部单测通过**

Run: `bun run test`
Expected: 全绿。
Run: `bun run dev`
Expected: 空白窗口启动无报错（devtools console 无 `window.devdock` 相关错误）。关闭窗口。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire IPC, preload bridge and AppController into main"
```

---

### Task 3: Zustand 状态层（含测试）

> **2026-06-15 最终审查补丁：** `onSessionStatus` 回调在 `applyStatus` 之后，若 `s.status === 'errored'` 则额外触发 `toast.error('脚本运行出错', { description: s.scriptId.split('::')[1] })`（动态 import sonner）。

**Files:**
- Create: `src/renderer/src/store/useAppStore.ts`
- Test: `src/renderer/src/store/useAppStore.test.ts`

- [ ] **Step 1: 安装 zustand**

```bash
bun add zustand
```

- [ ] **Step 2: 写失败测试（reducer 行为，mock window.devdock）**

`src/renderer/src/store/useAppStore.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from './useAppStore'
import type { SessionState } from '@shared/types'

beforeEach(() => {
  useAppStore.setState({ projects: [], sessions: {}, selectedProjectId: undefined, selectedScriptId: undefined, openTabs: [] })
})

describe('useAppStore reducers', () => {
  it('applyStatus stores session by key', () => {
    const s: SessionState = { scriptId: 'p1::.#dev', pid: 9, status: 'running', startedAt: 1 }
    useAppStore.getState().applyStatus(s)
    expect(useAppStore.getState().sessions['p1::.#dev'].status).toBe('running')
  })

  it('applyUrl updates url on existing session', () => {
    useAppStore.getState().applyStatus({ scriptId: 'p1::.#dev', pid: 9, status: 'running', startedAt: 1 })
    useAppStore.getState().applyUrl('p1::.#dev', 'http://localhost:5173/')
    expect(useAppStore.getState().sessions['p1::.#dev'].url).toBe('http://localhost:5173/')
  })

  it('openTab adds unique tabs and sets selection', () => {
    useAppStore.getState().openTab('p1::.#dev')
    useAppStore.getState().openTab('p1::.#dev')
    expect(useAppStore.getState().openTabs).toEqual(['p1::.#dev'])
    expect(useAppStore.getState().selectedScriptId).toBe('p1::.#dev')
  })

  it('closeTab removes tab and clears selection if active', () => {
    useAppStore.getState().openTab('p1::.#dev')
    useAppStore.getState().closeTab('p1::.#dev')
    expect(useAppStore.getState().openTabs).toEqual([])
    expect(useAppStore.getState().selectedScriptId).toBeUndefined()
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `bunx vitest run src/renderer/src/store/useAppStore.test.ts`
Expected: FAIL（模块未找到）。

- [ ] **Step 4: 实现 store**

`src/renderer/src/store/useAppStore.ts`:
```ts
import { create } from 'zustand'
import type { Project, SessionState, ThemeMode } from '@shared/types'
import { sessionKey } from '@shared/util'

interface AppState {
  projects: Project[]
  sessions: Record<string, SessionState>
  selectedProjectId?: string
  selectedScriptId?: string // sessionKey of focused terminal tab
  openTabs: string[] // sessionKeys
  theme: ThemeMode

  init(): Promise<void>
  selectProject(id: string): void
  addProject(): Promise<void>
  removeProject(id: string): Promise<void>
  renameProject(id: string, name: string): Promise<void>
  rescanProject(id: string): Promise<void>
  relocateProject(id: string): Promise<void>
  startScript(projectId: string, scriptId: string): Promise<void>
  stopScript(key: string): Promise<void>
  restartScript(projectId: string, scriptId: string): Promise<void>
  openTab(key: string): void
  closeTab(key: string): void
  setTheme(theme: ThemeMode): Promise<void>
  applyThemeClass(): void

  applyStatus(s: SessionState): void
  applyUrl(key: string, url: string): void
  applyProjectUpdated(p: Project): void
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  sessions: {},
  openTabs: [],
  theme: 'system',

  async init() {
    const [projects, ui, sessions] = await Promise.all([
      window.devdock.projects.list(),
      window.devdock.ui.getState(),
      window.devdock.sessions.list()
    ])
    const sessMap: Record<string, SessionState> = {}
    for (const s of sessions) sessMap[s.scriptId] = s
    set({
      projects,
      sessions: sessMap,
      theme: ui.theme,
      selectedProjectId: ui.selectedProjectId ?? projects[0]?.id
    })
    get().applyThemeClass()

    window.devdock.onSessionStatus((s) => get().applyStatus(s))
    window.devdock.onSessionUrl((key, url) => get().applyUrl(key, url))
    window.devdock.onProjectUpdated((p) => get().applyProjectUpdated(p))

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', () => {
      if (get().theme === 'system') get().applyThemeClass()
    })
  },

  selectProject(id) {
    set({ selectedProjectId: id })
    window.devdock.ui.setState({ selectedProjectId: id })
  },

  async addProject() {
    const p = await window.devdock.projects.add()
    if (p) {
      set((st) => ({ projects: [...st.projects, p], selectedProjectId: p.id }))
      window.devdock.ui.setState({ selectedProjectId: p.id })
    }
  },

  async removeProject(id) {
    await window.devdock.projects.remove(id)
    set((st) => {
      const projects = st.projects.filter((p) => p.id !== id)
      return {
        projects,
        selectedProjectId: st.selectedProjectId === id ? projects[0]?.id : st.selectedProjectId
      }
    })
  },

  async renameProject(id, name) {
    await window.devdock.projects.rename(id, name)
    set((st) => ({ projects: st.projects.map((p) => (p.id === id ? { ...p, name } : p)) }))
  },

  async rescanProject(id) {
    const p = await window.devdock.projects.rescan(id)
    if (p) get().applyProjectUpdated(p)
  },

  async relocateProject(id) {
    const p = await window.devdock.projects.relocate(id)
    if (p) get().applyProjectUpdated(p)
  },

  async startScript(projectId, scriptId) {
    const key = sessionKey(projectId, scriptId)
    get().openTab(key)
    await window.devdock.scripts.start(projectId, scriptId)
  },

  async stopScript(key) {
    await window.devdock.scripts.stop(key)
  },

  async restartScript(projectId, scriptId) {
    const key = sessionKey(projectId, scriptId)
    get().openTab(key)
    await window.devdock.scripts.restart(projectId, scriptId)
  },

  openTab(key) {
    set((st) => ({
      openTabs: st.openTabs.includes(key) ? st.openTabs : [...st.openTabs, key],
      selectedScriptId: key
    }))
  },

  closeTab(key) {
    set((st) => {
      const openTabs = st.openTabs.filter((k) => k !== key)
      return {
        openTabs,
        selectedScriptId:
          st.selectedScriptId === key ? openTabs[openTabs.length - 1] : st.selectedScriptId
      }
    })
  },

  async setTheme(theme) {
    set({ theme })
    await window.devdock.ui.setState({ theme })
    get().applyThemeClass()
  },

  applyThemeClass() {
    const { theme } = get()
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
  },

  applyStatus(s) {
    set((st) => ({ sessions: { ...st.sessions, [s.scriptId]: s } }))
  },

  applyUrl(key, url) {
    set((st) => {
      const sess = st.sessions[key]
      if (!sess) return {}
      return { sessions: { ...st.sessions, [key]: { ...sess, url } } }
    })
  },

  applyProjectUpdated(p) {
    set((st) => ({ projects: st.projects.map((x) => (x.id === p.id ? p : x)) }))
  }
}))
```

- [ ] **Step 5: 运行测试确认通过**

Run: `bunx vitest run src/renderer/src/store/useAppStore.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add zustand app store with ipc subscriptions"
```

---

### Task 4: App 外壳布局 + 主题切换

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/components/ThemeToggle.tsx`

- [ ] **Step 1: 写主题切换组件**

`src/renderer/src/components/ThemeToggle.tsx`:
```tsx
import { Sun, Moon, Monitor } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { ThemeMode } from '@shared/types'

const MODES: { mode: ThemeMode; icon: typeof Sun }[] = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'system', icon: Monitor }
]

export function ThemeToggle(): JSX.Element {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
      {MODES.map(({ mode, icon: Icon }) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground',
            theme === mode && 'bg-accent text-accent-foreground'
          )}
          title={mode}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 写 App 三栏外壳**

`src/renderer/src/App.tsx`:
```tsx
import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { ProjectView } from '@/components/ProjectView'
import { Toaster } from '@/components/ui/sonner'

export default function App(): JSX.Element {
  const init = useAppStore((s) => s.init)
  useEffect(() => {
    init()
  }, [init])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground text-sm">
      <Sidebar />
      <ProjectView />
      <Toaster position="bottom-right" />
    </div>
  )
}
```

> `Sidebar`、`ProjectView` 将在后续 Task 创建；本步暂时会编译报错，下一步补 `ProjectView` 占位与 Task 5/6/7 实现。

- [ ] **Step 3: 写 ProjectView 容器（左右结构：脚本列表 | 终端）**

`src/renderer/src/components/ProjectView.tsx`:
```tsx
import { useAppStore } from '@/store/useAppStore'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ScriptList } from '@/components/ScriptList/ScriptList'
import { TerminalDock } from '@/components/Terminal/TerminalDock'
import { Button } from '@/components/ui/button'
import { RefreshCw, FolderOpen } from 'lucide-react'

export function ProjectView(): JSX.Element {
  const project = useAppStore((s) => s.projects.find((p) => p.id === s.selectedProjectId))
  const rescan = useAppStore((s) => s.rescanProject)

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        从左侧选择或添加一个项目
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{project.name}</div>
          <div className="truncate text-xs text-muted-foreground">{project.path}</div>
        </div>
        <Button variant="ghost" size="icon" title="重扫" onClick={() => rescan(project.id)}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="打开目录"
          onClick={() => window.devdock.shell.revealInFinder(project.path)}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <ScriptList project={project} />
        <TerminalDock />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit（先提交外壳，组件在后续 Task 落地）**

> 注：此时 `Sidebar`/`ScriptList`/`TerminalDock` 尚未创建，应用无法编译。按 Task 5→6→7 顺序补齐后再统一验证。本步仅提交已写文件。
```bash
git add src/renderer/src/App.tsx src/renderer/src/components/ProjectView.tsx src/renderer/src/components/ThemeToggle.tsx
git commit -m "feat: add app shell, project view and theme toggle"
```

---

### Task 5: Sidebar 项目列表

**Files:**
- Create: `src/renderer/src/components/Sidebar/Sidebar.tsx`, `src/renderer/src/components/Sidebar/ProjectRow.tsx`

- [ ] **Step 1: 写 ProjectRow（含右键菜单、运行数徽标）**

`src/renderer/src/components/Sidebar/ProjectRow.tsx`:
```tsx
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { Project } from '@shared/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MoreVertical, AlertTriangle } from 'lucide-react'

export function ProjectRow({ project }: { project: Project }): JSX.Element {
  const selected = useAppStore((s) => s.selectedProjectId === project.id)
  const selectProject = useAppStore((s) => s.selectProject)
  const removeProject = useAppStore((s) => s.removeProject)
  const renameProject = useAppStore((s) => s.renameProject)
  const rescanProject = useAppStore((s) => s.rescanProject)
  const relocateProject = useAppStore((s) => s.relocateProject)
  const runningCount = useAppStore((s) => {
    const prefix = project.id + '::'
    return Object.values(s.sessions).filter(
      (x) => x.scriptId.startsWith(prefix) && (x.status === 'running' || x.status === 'starting')
    ).length
  })

  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(project.name)

  const commitRename = (): void => {
    renameProject(project.id, draft.trim() || project.name)
    setRenaming(false)
  }

  return (
    <>
      <div
        onClick={() => selectProject(project.id)}
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5',
          selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate font-medium">
            {project.missing && <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />}
            {project.name}
          </div>
          <div className="truncate text-xs text-muted-foreground">{project.path}</div>
        </div>
        {runningCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
            {runningCount}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={() => {
                setDraft(project.name)
                setRenaming(true)
              }}
            >
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => rescanProject(project.id)}>重扫</DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.devdock.shell.revealInFinder(project.path)}>
              在 Finder 显示
            </DropdownMenuItem>
            {project.missing && (
              <DropdownMenuItem onClick={() => relocateProject(project.id)}>
                重新定位…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm(`移除项目「${project.name}」？正在运行的脚本会被终止。`)) {
                  removeProject(project.id)
                }
              }}
            >
              移除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              取消
            </Button>
            <Button onClick={commitRename}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: 写 Sidebar**

`src/renderer/src/components/Sidebar/Sidebar.tsx`:
```tsx
import { useAppStore } from '@/store/useAppStore'
import { ProjectRow } from './ProjectRow'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

export function Sidebar(): JSX.Element {
  const projects = useAppStore((s) => s.projects)
  const addProject = useAppStore((s) => s.addProject)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-card/40">
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="pl-14 font-semibold">DevDock</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={addProject}
          title="添加项目"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {projects.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">点击右上角 + 添加项目文件夹</p>
          ) : (
            projects.map((p) => <ProjectRow key={p.id} project={p} />)
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
```

> `pl-14` 为 macOS 红绿灯按钮留位；非 mac 可按需调整。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add sidebar with project list and row actions"
```

---

### Task 6: ScriptList 与 ScriptItem（含 RTL 测试）

> **2026-06-15 最终审查补丁：** `WorkspaceBlock` 现在是可折叠组件。新增 `useState(false)` 控制 `collapsed`，monorepo header 改为 `<button>` 带 `ChevronRight`/`ChevronDown` 图标；脚本列表内容用 `{!collapsed && ...}` 包裹。仅当 `project.isMonorepo` 时显示可折叠 header。新增 imports：`useState` from react，`ChevronRight, ChevronDown` from lucide-react。

**Files:**
- Create: `src/renderer/src/components/ScriptList/ScriptList.tsx`, `src/renderer/src/components/ScriptList/ScriptItem.tsx`, `src/renderer/src/components/ScriptList/useElapsed.ts`
- Test: `src/renderer/src/components/ScriptList/ScriptItem.test.tsx`

- [ ] **Step 1: 写 useElapsed 计时 hook**

`src/renderer/src/components/ScriptList/useElapsed.ts`:
```ts
import { useEffect, useState } from 'react'

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h${m}m`
  if (m > 0) return `${m}m${sec}s`
  return `${sec}s`
}

export function useElapsed(startedAt: number | undefined, active: boolean): string {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [active])
  if (!startedAt) return ''
  return formatElapsed(Date.now() - startedAt)
}
```

- [ ] **Step 2: 写 ScriptItem 失败测试**

`src/renderer/src/components/ScriptList/ScriptItem.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScriptItem } from './ScriptItem'
import { useAppStore } from '@/store/useAppStore'
import type { ScriptDef } from '@shared/types'

const def: ScriptDef = { id: '.#dev', name: 'dev', command: 'vite', kind: 'long-running', cwd: '/x' }

beforeEach(() => {
  ;(globalThis as any).window.devdock = {
    scripts: { start: vi.fn(), stop: vi.fn(), restart: vi.fn() },
    shell: { openExternal: vi.fn() }
  }
  useAppStore.setState({ sessions: {}, selectedProjectId: 'p1' })
})

describe('ScriptItem', () => {
  it('shows command and a start affordance when stopped', () => {
    render(<ScriptItem projectId="p1" def={def} />)
    expect(screen.getByText('dev')).toBeInTheDocument()
    expect(screen.getByText('vite')).toBeInTheDocument()
    expect(screen.getByTitle('启动')).toBeInTheDocument()
  })

  it('shows PID, url and stop affordance when running', () => {
    useAppStore.setState({
      sessions: { 'p1::.#dev': { scriptId: 'p1::.#dev', pid: 321, status: 'running', startedAt: Date.now(), url: 'http://localhost:5173/' } }
    })
    render(<ScriptItem projectId="p1" def={def} />)
    expect(screen.getByText(/321/)).toBeInTheDocument()
    expect(screen.getByText('http://localhost:5173/')).toBeInTheDocument()
    expect(screen.getByTitle('停止')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `bunx vitest run src/renderer/src/components/ScriptList/ScriptItem.test.tsx`
Expected: FAIL（模块未找到）。

- [ ] **Step 4: 实现 ScriptItem**

`src/renderer/src/components/ScriptList/ScriptItem.tsx`:
```tsx
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { sessionKey } from '@shared/util'
import type { ScriptDef, SessionStatus } from '@shared/types'
import { useElapsed } from './useElapsed'
import { Play, Square, RotateCw, ExternalLink } from 'lucide-react'

const DOT: Record<SessionStatus | 'idle', string> = {
  idle: 'bg-muted-foreground/40',
  starting: 'bg-amber-500 animate-pulse',
  running: 'bg-emerald-500',
  exited: 'bg-muted-foreground/40',
  errored: 'bg-destructive'
}

export function ScriptItem({ projectId, def }: { projectId: string; def: ScriptDef }): JSX.Element {
  const key = sessionKey(projectId, def.id)
  const session = useAppStore((s) => s.sessions[key])
  const selected = useAppStore((s) => s.selectedScriptId === key)
  const openTab = useAppStore((s) => s.openTab)
  const startScript = useAppStore((s) => s.startScript)
  const stopScript = useAppStore((s) => s.stopScript)
  const restartScript = useAppStore((s) => s.restartScript)

  const status: SessionStatus | 'idle' = session?.status ?? 'idle'
  const isActive = status === 'running' || status === 'starting'
  const elapsed = useElapsed(session?.startedAt, isActive)

  return (
    <div
      onClick={() => openTab(key)}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2',
        selected ? 'border-ring bg-accent/60' : 'hover:bg-accent/40'
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT[status])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{def.name}</span>
          {isActive && session && (
            <span className="text-xs text-muted-foreground">PID {session.pid} · {elapsed}</span>
          )}
          {status === 'errored' && <span className="text-xs text-destructive">异常退出</span>}
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground">{def.command}</div>
        {session?.url && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.devdock.shell.openExternal(session.url!)
            }}
            className="mt-0.5 flex items-center gap-1 text-xs text-blue-500 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {session.url}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {isActive ? (
          <>
            <button title="重启" onClick={() => restartScript(projectId, def.id)}>
              <RotateCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
            <button title="停止" onClick={() => stopScript(key)}>
              <Square className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </>
        ) : (
          <button title="启动" onClick={() => startScript(projectId, def.id)}>
            <Play className="h-4 w-4 text-muted-foreground hover:text-emerald-500" />
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `bunx vitest run src/renderer/src/components/ScriptList/ScriptItem.test.tsx`
Expected: PASS（2 个用例）。

- [ ] **Step 6: 实现 ScriptList（分组：workspace → 服务/任务）**

`src/renderer/src/components/ScriptList/ScriptList.tsx`:
```tsx
import { useAppStore } from '@/store/useAppStore'
import type { Project, WorkspacePkg } from '@shared/types'
import { ScriptItem } from './ScriptItem'
import { ScrollArea } from '@/components/ui/scroll-area'

function Group({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-3">
      <div className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function WorkspaceBlock({ project, ws }: { project: Project; ws: WorkspacePkg }): JSX.Element {
  const longRunning = ws.scripts.filter((s) => s.kind === 'long-running')
  const oneShot = ws.scripts.filter((s) => s.kind === 'one-shot')
  return (
    <div className="mb-4">
      {project.isMonorepo && (
        <div className="mb-2 text-sm font-semibold">{ws.name} <span className="text-xs text-muted-foreground">{ws.relPath}</span></div>
      )}
      {longRunning.length > 0 && (
        <Group title="服务">
          {longRunning.map((s) => (
            <ScriptItem key={s.id} projectId={project.id} def={s} />
          ))}
        </Group>
      )}
      {oneShot.length > 0 && (
        <Group title="任务">
          {oneShot.map((s) => (
            <ScriptItem key={s.id} projectId={project.id} def={s} />
          ))}
        </Group>
      )}
    </div>
  )
}

export function ScriptList({ project }: { project: Project }): JSX.Element {
  if (project.missing) {
    return (
      <div className="flex w-1/2 items-center justify-center border-r p-6 text-center text-sm text-muted-foreground">
        项目目录不存在，请通过右键菜单「重新定位」或移除该项目。
      </div>
    )
  }
  return (
    <ScrollArea className="w-1/2 shrink-0 border-r">
      <div className="p-3">
        {project.workspaces.map((ws) => (
          <WorkspaceBlock key={ws.relPath} project={project} ws={ws} />
        ))}
      </div>
    </ScrollArea>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add script list with grouping and script item states"
```

---

### Task 7: 终端面板（xterm）

**Files:**
- Create: `src/renderer/src/components/Terminal/TerminalDock.tsx`, `src/renderer/src/components/Terminal/TerminalView.tsx`

- [ ] **Step 1: 安装 xterm**

```bash
bun add @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-search
```

- [ ] **Step 2: 实现 TerminalView（单个会话的 xterm 实例）**

`src/renderer/src/components/Terminal/TerminalView.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export function TerminalView({ sessionKey, visible }: { sessionKey: string; visible: boolean }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      cursorBlink: true,
      theme: { background: '#00000000' },
      allowTransparency: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(
      new WebLinksAddon((_e, uri) => window.devdock.shell.openExternal(uri))
    )
    term.open(ref.current!)
    termRef.current = term
    fitRef.current = fit

    // 回填历史缓冲
    window.devdock.terminal.getBuffer(sessionKey).then((buf) => {
      if (buf) term.write(buf)
    })

    const off = window.devdock.onTerminalData((key, chunk) => {
      if (key === sessionKey) term.write(chunk)
    })

    const onInput = term.onData((data) => window.devdock.terminal.write(sessionKey, data))

    const doFit = (): void => {
      try {
        fit.fit()
        window.devdock.terminal.resize(sessionKey, term.cols, term.rows)
      } catch {
        /* element not visible yet */
      }
    }
    const ro = new ResizeObserver(doFit)
    ro.observe(ref.current!)
    setTimeout(doFit, 0)

    return () => {
      off()
      onInput.dispose()
      ro.disconnect()
      term.dispose()
    }
  }, [sessionKey])

  useEffect(() => {
    if (visible) setTimeout(() => fitRef.current?.fit(), 0)
  }, [visible])

  return <div ref={ref} className="h-full w-full" style={{ display: visible ? 'block' : 'none' }} />
}
```

- [ ] **Step 3: 实现 TerminalDock（tab 栏 + 多个常驻 TerminalView）**

`src/renderer/src/components/Terminal/TerminalDock.tsx`:
```tsx
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { TerminalView } from './TerminalView'

function tabLabel(key: string): string {
  return key.split('::')[1]?.split('#')[1] ?? key
}

export function TerminalDock(): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const active = useAppStore((s) => s.selectedScriptId)
  const setActive = useAppStore((s) => s.openTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const sessions = useAppStore((s) => s.sessions)

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-card/20">
      <div className="flex h-8 items-center gap-0.5 overflow-x-auto border-b px-1">
        {openTabs.length === 0 && (
          <span className="px-2 text-xs text-muted-foreground">选择脚本以打开终端</span>
        )}
        {openTabs.map((key) => {
          const st = sessions[key]?.status
          return (
            <div
              key={key}
              onClick={() => setActive(key)}
              className={cn(
                'flex h-6 cursor-pointer items-center gap-1.5 rounded px-2 text-xs',
                active === key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  st === 'running' ? 'bg-emerald-500' : st === 'starting' ? 'bg-amber-500' : st === 'errored' ? 'bg-destructive' : 'bg-muted-foreground/40'
                )}
              />
              {tabLabel(key)}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(key)
                }}
              >
                <X className="h-3 w-3 hover:text-foreground" />
              </button>
            </div>
          )
        })}
      </div>
      <div className="relative flex-1 overflow-hidden p-1">
        {openTabs.map((key) => (
          <div key={key} className="absolute inset-1">
            <TerminalView sessionKey={key} visible={active === key} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 验证完整界面启动**

Run: `bun run dev`
Expected: 应用启动，左栏可点 + 添加一个真实前端项目（含 package.json），右侧列出脚本，点击「启动」dev 脚本后右侧终端出现实时输出，运行状态点变绿，PID/运行时长显示，检测到 `http://localhost:xxxx` 后出现可点击链接。点击停止可终止。手动关闭窗口。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add xterm terminal dock with per-session tabs"
```

---

### Task 8: 文件监听自动重扫 + 运行中脚本变更提示

**Files:**
- Modify: `src/renderer/src/store/useAppStore.ts`（订阅 onScriptChanged）

> 主进程侧的监听与 `project:updated`/`script:changed` 事件已在 Task 1/2 实现并接线（`AppController.handleWatchChange` + `FileWatcher`）。本 Task 在渲染层补上对脚本变更的提示。

- [ ] **Step 1: 在 store.init 内订阅 onScriptChanged，用 toast 提示重启**

Modify `src/renderer/src/store/useAppStore.ts`，在 `init()` 中已有事件订阅之后追加：
```ts
    window.devdock.onScriptChanged((key) => {
      const [projectId, scriptId] = key.split('::')
      // 动态导入 toast，避免在测试 node 环境下加载 UI
      import('sonner').then(({ toast }) => {
        toast('脚本定义已更新', {
          description: scriptId,
          action: {
            label: '重启',
            onClick: () => get().restartScript(projectId, scriptId)
          }
        })
      })
    })
```

- [ ] **Step 2: 手动验证**

Run: `bun run dev`
启动某个 dev 脚本后，在编辑器里修改该项目 `package.json` 中此脚本的命令并保存。
Expected: 脚本列表自动刷新（命令文本变化），并弹出「脚本定义已更新」toast，点「重启」可重启该会话。手动关闭窗口。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: prompt restart when a running script definition changes"
```

---

### Task 9: 退出确认（有运行中脚本时）

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: 退出前若有运行中会话则弹窗确认**

Modify `src/main/index.ts`，将 `app.on('before-quit', ...)` 替换为：
```ts
let quitting = false
app.on('before-quit', (e) => {
  if (quitting) return
  const running = controller
    ?.listSessions()
    .filter((s) => s.status === 'running' || s.status === 'starting')
  if (running && running.length > 0) {
    e.preventDefault()
    const { dialog } = require('electron')
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: 'question',
      buttons: ['退出并终止', '取消'],
      defaultId: 0,
      cancelId: 1,
      message: `有 ${running.length} 个脚本正在运行，确定退出并终止它们吗？`
    })
    if (choice === 0) {
      quitting = true
      controller.shutdown()
      app.quit()
    }
  } else {
    controller?.shutdown()
  }
})
```

- [ ] **Step 2: 手动验证**

Run: `bun run dev`
启动一个 dev 脚本，然后关闭窗口/退出应用。
Expected: 弹出确认框；选「退出并终止」后子进程被杀（用系统活动监视器/`lsof -i :端口` 确认端口释放）；选「取消」则应用保持运行。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: confirm before quit and kill child processes"
```

---

### Task 10: 最终验收

**Files:** 无（验证 + 文档）

- [ ] **Step 1: 跑全部测试**

Run: `bun run test`
Expected: 全绿（UrlDetector / Scanner / scriptDiff / ProjectStore / ProcessManager / AppController / useAppStore / ScriptItem）。

- [ ] **Step 2: 端到端手动清单**

逐项确认：
1. 添加单包前端项目 → 列出全部 scripts，dev 归「服务」、build 归「任务」。
2. 添加 monorepo 项目 → 按子包分组展示。
3. 启动 / 停止 / 重启脚本，状态点、PID、运行时长正确。
4. dev server URL（含 `*.localhost` portless）被探测并可点击打开。
5. 多脚本可同时运行，终端 tab 可切换、可关闭。
6. 修改 package.json → 列表自动更新；运行中脚本变更 → toast 提示重启。
7. 主题：跟随系统 + 手动切换三态均生效。
8. 删除项目目录 → 标记缺失、可重新定位。
9. 退出确认 + 子进程被清理。

- [ ] **Step 3: 构建产物冒烟**

Run: `bun run build`
Expected: 构建成功，`out/` 生成 main/preload/renderer。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: devdock v1 complete"
```

---

## Part 2 完成标准

- DevDock 完整可用：增删改查项目、扫描并分类脚本、启停重启、终端实时输出、URL 探测、文件变更自动重扫与重启提示、主题切换、安全退出。
- `bun run test` 全绿，`bun run build` 通过。
