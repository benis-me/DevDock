export type PackageManager = 'pnpm' | 'yarn' | 'npm' | 'bun'
export type ScriptKind = 'long-running' | 'one-shot'
export type SessionStatus = 'starting' | 'running' | 'exited' | 'errored'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface ScriptDef {
  id: string            // `${relPath}#${name}`（非 npm 源用 `${relPath}#<source>:<name>`）
  name: string
  command: string       // 展示用命令文本
  kind: ScriptKind
  cwd: string
  source?: string       // 'npm' | 'make' | 'compose' | 'procfile' | 'cargo' | 'just' | 'deno'
  runCmd?: string       // 实际运行命令（非 npm 必填；npm 留空由 packageManager 推导）
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
  pinned?: boolean
  type?: string // 推断的项目类型（Xcode / Unity / Vite / Rust / …）用于显示图标
}

export interface AppInfo {
  id: string
  name: string
  kind: 'editor' | 'terminal' | 'other'
  icon: string // data URL (PNG) of the app icon
}

export interface PortProcess {
  pid: number
  command: string
}

export interface GitInfo {
  branch: string | null
  dirty: boolean
  changes: number // 改动文件数
  ahead: number
  behind: number
}

export interface UiState {
  theme: ThemeMode
  selectedProjectId?: string
  lastSelectedScriptId?: string
  openWithDefault?: string // last-used "open with" app id
  // restored workspace (open tabs) across restarts
  openTabs?: string[]
  openEnvPaths?: string[]
  activeEnvPath?: string
  selectedScriptId?: string
}

export interface ScriptPrefs {
  portless?: boolean
  pinned?: boolean
}

export interface Settings {
  terminalFontSize: number // px
  terminalCursorBlink: boolean
  portlessDefault: boolean // 长任务默认用 portless 启动（无逐脚本设置时）
  injectEnv: boolean // 启动脚本时注入项目 .env / .env.local
  confirmOnQuit: boolean // 退出时若有运行中脚本则二次确认
  notifyOnFinish: boolean // 脚本异常退出/一次性任务完成时发系统通知（窗口未聚焦时）
}

export const DEFAULT_SETTINGS: Settings = {
  terminalFontSize: 12,
  terminalCursorBlink: true,
  portlessDefault: false,
  injectEnv: true,
  confirmOnQuit: true,
  notifyOnFinish: true
}

export interface Config {
  version: number
  projects: Project[]
  ui: UiState
  scriptPrefs: Record<string, ScriptPrefs> // key: `${projectId}::${scriptId}`
  settings: Settings
}

export interface SessionState {
  scriptId: string
  pid: number
  status: SessionStatus
  startedAt: number
  exitCode?: number
  urls?: string[] // 检测到的服务链接（origin，可能多个：前端 + 后端…）
}

export const CONFIG_VERSION = 1

export const DEFAULT_CONFIG: Config = {
  version: CONFIG_VERSION,
  projects: [],
  ui: { theme: 'system' },
  scriptPrefs: {},
  settings: { ...DEFAULT_SETTINGS }
}
