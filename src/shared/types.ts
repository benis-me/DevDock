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

export interface EnvFile {
  name: string          // ".env" / ".env.local" / ".env.production"
  relPath: string       // 所在目录相对项目根，根目录为 "."
  path: string          // 绝对路径（唯一键）
}

export interface Project {
  id: string
  name: string
  path: string
  packageManager: PackageManager
  isMonorepo: boolean
  workspaces: WorkspacePkg[]
  envFiles: EnvFile[]
  addedAt: number
  missing?: boolean
}

export interface UiState {
  theme: ThemeMode
  selectedProjectId?: string
  lastSelectedScriptId?: string
}

export interface ScriptPrefs {
  portless?: boolean
}

export interface Config {
  version: number
  projects: Project[]
  ui: UiState
  scriptPrefs: Record<string, ScriptPrefs> // key: `${projectId}::${scriptId}`
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
  ui: { theme: 'system' },
  scriptPrefs: {}
}
