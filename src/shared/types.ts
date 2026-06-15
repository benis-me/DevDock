export type PackageManager = 'pnpm' | 'yarn' | 'npm' | 'bun'
export type ScriptKind = 'long-running' | 'one-shot'
export type SessionStatus = 'starting' | 'running' | 'exited' | 'errored'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface ScriptDef {
  id: string            // `${relPath}#${name}`
  name: string
  command: string
  kind: ScriptKind
  cwd: string
}

export interface WorkspacePkg {
  name: string
  relPath: string       // 相对项目根，根包为 "."
  scripts: ScriptDef[]
}

export interface Project {
  id: string
  name: string
  path: string
  packageManager: PackageManager
  isMonorepo: boolean
  workspaces: WorkspacePkg[]
  addedAt: number
  missing?: boolean
}

export interface UiState {
  theme: ThemeMode
  selectedProjectId?: string
  lastSelectedScriptId?: string
}

export interface Config {
  version: number
  projects: Project[]
  ui: UiState
}

export interface SessionState {
  scriptId: string
  pid: number
  status: SessionStatus
  startedAt: number
  exitCode?: number
  url?: string
}

export const CONFIG_VERSION = 1

export const DEFAULT_CONFIG: Config = {
  version: CONFIG_VERSION,
  projects: [],
  ui: { theme: 'system' }
}
