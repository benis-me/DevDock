import type {
  AppInfo,
  GitInfo,
  PortProcess,
  Project,
  ScriptPrefs,
  SessionState,
  Settings,
  UiState
} from './types'

export interface DevDockApi {
  projects: {
    list(): Promise<Project[]>
    add(): Promise<Project | null>
    addPath(path: string): Promise<Project | null>
    remove(id: string): Promise<void>
    rename(id: string, name: string): Promise<void>
    rescan(id: string): Promise<Project | null>
    relocate(id: string): Promise<Project | null>
    reorder(orderedIds: string[]): Promise<void>
    setPinned(id: string, pinned: boolean): Promise<void>
  }
  scripts: {
    start(projectId: string, scriptId: string): Promise<void>
    stop(sessionKey: string): Promise<void>
    restart(projectId: string, scriptId: string): Promise<void>
    prefs(): Promise<Record<string, ScriptPrefs>>
    setPortless(projectId: string, scriptId: string, enabled: boolean): Promise<void>
    portlessAvailable(): Promise<boolean>
  }
  terminal: {
    write(sessionKey: string, data: string): Promise<void>
    resize(sessionKey: string, cols: number, rows: number): Promise<void>
    getBuffer(sessionKey: string): Promise<string>
    clear(sessionKey: string): Promise<void>
  }
  shell: {
    openExternal(url: string): Promise<void>
    openPath(path: string): Promise<void>
  }
  env: {
    read(path: string): Promise<string>
    write(path: string, content: string): Promise<void>
  }
  apps: {
    list(): Promise<AppInfo[]>
    openWith(appId: string, path: string): Promise<void>
  }
  ports: {
    who(port: number): Promise<PortProcess[]>
    kill(port: number): Promise<number[]>
    killPid(pid: number): Promise<boolean>
  }
  settings: {
    get(): Promise<Settings>
    set(partial: Partial<Settings>): Promise<Settings>
  }
  git: {
    statusAll(): Promise<Record<string, GitInfo | null>>
  }
  ui: {
    getState(): Promise<UiState>
    setState(partial: Partial<UiState>): Promise<void>
  }
  sessions: { list(): Promise<SessionState[]> }
  versions: { electron: string; node: string; chrome: string }
  getPathForFile(file: File): string
  onTerminalData(cb: (sessionKey: string, chunk: string) => void): () => void
  onSessionStatus(cb: (state: SessionState) => void): () => void
  onSessionUrl(cb: (sessionKey: string, url: string) => void): () => void
  onProjectUpdated(cb: (project: Project) => void): () => void
  onScriptChanged(cb: (sessionKey: string) => void): () => void
  onEnvChanged(cb: (path: string) => void): () => void
  onPortConflict(cb: (sessionKey: string, port: number) => void): () => void
  onGitStatus(cb: (projectId: string, info: GitInfo | null) => void): () => void
}

declare global {
  interface Window {
    devdock: DevDockApi
  }
}
