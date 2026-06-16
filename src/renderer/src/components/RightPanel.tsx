import type { JSX, ReactNode } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { X, SquareTerminal, Play, FileCog } from 'lucide-react'
import { TerminalView } from '@/components/Terminal/TerminalView'
import { EnvEditor } from '@/components/Env/EnvEditor'
import type { Project, ScriptDef } from '@shared/types'

function tabLabel(key: string): string {
  return key.split('::')[1]?.split('#')[1] ?? key
}
function fileName(p: string): string {
  return p.split('/').pop() ?? p
}

const DOT: Record<string, string> = {
  running: 'bg-run',
  starting: 'bg-warn',
  errored: 'bg-destructive'
}

function findDef(projects: Project[], key: string): { projectId: string; def: ScriptDef } | null {
  const [projectId, scriptId] = key.split('::')
  const project = projects.find((p) => p.id === projectId)
  if (!project) return null
  for (const ws of project.workspaces) {
    const def = ws.scripts.find((s) => s.id === scriptId)
    if (def) return { projectId, def }
  }
  return null
}

function NotStarted({ projectId, def }: { projectId: string; def: ScriptDef }): JSX.Element {
  const startScript = useAppStore((s) => s.startScript)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-white/30">
        <SquareTerminal className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-sm font-medium text-white/85">{def.name}</div>
        <div className="mt-1 font-mono text-xs text-white/40">{def.command}</div>
      </div>
      <button
        onClick={() => startScript(projectId, def.id)}
        className="inline-flex items-center gap-1.5 rounded-md bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-[#0c0f16] transition-all hover:bg-white active:scale-95"
      >
        <Play className="h-3.5 w-3.5" /> 启动脚本
      </button>
      <p className="text-[11px] text-white/25">尚未运行 · 启动后这里显示实时输出</p>
    </div>
  )
}

function Tab({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group/tab flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      {children}
    </div>
  )
}

// 终端 tab 右侧槽位：默认状态点，hover 时变关闭按钮（同位置切换）
function TermSlot({ status, onClose }: { status?: string; onClose: () => void }): JSX.Element {
  return (
    <span className="relative ml-0.5 flex h-3.5 w-3.5 items-center justify-center">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full transition-opacity group-hover/tab:opacity-0',
          DOT[status ?? ''] ?? 'bg-idle',
          status === 'running' && 'glow-run breathe'
        )}
      />
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="关闭"
        className="absolute inset-0 flex items-center justify-center rounded opacity-0 transition-opacity hover:text-foreground group-hover/tab:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

export function RightPanel({ project }: { project: Project }): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const openEnvPaths = useAppStore((s) => s.openEnvPaths)
  const projects = useAppStore((s) => s.projects)
  const selectedScriptId = useAppStore((s) => s.selectedScriptId)
  const activeEnvPath = useAppStore((s) => s.activeEnvPath)
  const openTab = useAppStore((s) => s.openTab)
  const openEnvFile = useAppStore((s) => s.openEnvFile)
  const closeTab = useAppStore((s) => s.closeTab)
  const closeEnv = useAppStore((s) => s.closeEnv)
  const sessions = useAppStore((s) => s.sessions)

  const projectId = project.id
  const termTabs = openTabs.filter((k) => k.startsWith(projectId + '::'))
  const envTabs = openEnvPaths.filter((p) => p.startsWith(project.path))

  const activeTermKey = activeEnvPath
    ? undefined
    : selectedScriptId && termTabs.includes(selectedScriptId)
      ? selectedScriptId
      : termTabs.at(-1)

  const total = termTabs.length + envTabs.length
  const notStarted =
    activeTermKey && !sessions[activeTermKey] ? findDef(projects, activeTermKey) : null

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      {/* unified tab bar — scrollbar hidden so it doesn't consume height */}
      <div className="no-scrollbar flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-card/40 px-2">
        {total === 0 ? (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <SquareTerminal className="h-3.5 w-3.5" />
            选择脚本或 .env 文件
          </div>
        ) : (
          <>
            {termTabs.map((key) => (
              <Tab key={key} active={activeTermKey === key} onClick={() => openTab(key)}>
                <span className="font-mono">{tabLabel(key)}</span>
                <TermSlot status={sessions[key]?.status} onClose={() => closeTab(key)} />
              </Tab>
            ))}
            {envTabs.map((p) => (
              <Tab key={p} active={activeEnvPath === p} onClick={() => openEnvFile(p)}>
                <FileCog className="h-3 w-3 shrink-0 opacity-70" />
                <span className="font-mono">{fileName(p)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeEnv(p)
                  }}
                  aria-label="关闭"
                  className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground group-hover/tab:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </Tab>
            ))}
          </>
        )}
      </div>

      {/* content — terminals + env editors kept mounted, toggled by visibility */}
      <div className="relative min-h-0 flex-1 bg-[#0c0f16]">
        {total === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/25">
            <SquareTerminal className="h-7 w-7" strokeWidth={1.25} />
            <p className="text-xs">选择左侧的脚本或环境变量文件</p>
          </div>
        ) : (
          <>
            {termTabs.map((key) => (
              <div key={key} className="absolute inset-0">
                <TerminalView sessionKey={key} visible={activeTermKey === key} />
              </div>
            ))}
            {envTabs.map((p) => (
              <div key={p} className="absolute inset-0">
                <EnvEditor path={p} visible={activeEnvPath === p} />
              </div>
            ))}
            {notStarted && (
              <div className="absolute inset-0 bg-[#0c0f16]">
                <NotStarted projectId={notStarted.projectId} def={notStarted.def} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
