import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { X, SquareTerminal, Play } from 'lucide-react'
import { TerminalView } from './TerminalView'
import type { Project, ScriptDef } from '@shared/types'

function tabLabel(key: string): string {
  return key.split('::')[1]?.split('#')[1] ?? key
}

const TAB_DOT: Record<string, string> = {
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

export function TerminalDock(): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const projectId = useAppStore((s) => s.selectedProjectId)
  const projects = useAppStore((s) => s.projects)
  const active = useAppStore((s) => s.selectedScriptId)
  const setActive = useAppStore((s) => s.openTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const sessions = useAppStore((s) => s.sessions)

  const projectTabs = projectId ? openTabs.filter((k) => k.startsWith(projectId + '::')) : []
  const activeKey = active && projectTabs.includes(active) ? active : projectTabs.at(-1)
  const notStarted = activeKey && !sessions[activeKey] ? findDef(projects, activeKey) : null

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {/* tab strip */}
      <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-card/40">
        {projectTabs.length === 0 ? (
          <div className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
            <SquareTerminal className="h-3.5 w-3.5" />
            选择脚本以查看终端
          </div>
        ) : (
          projectTabs.map((key) => {
            const st = sessions[key]?.status
            const isActive = activeKey === key
            return (
              <div
                key={key}
                onClick={() => setActive(key)}
                className={cn(
                  'group/tab relative flex h-full cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors',
                  isActive
                    ? 'bg-background font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                )}
              >
                {isActive && <span className="absolute inset-x-0 top-0 h-0.5 bg-foreground" />}
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    TAB_DOT[st ?? ''] ?? 'bg-idle',
                    st === 'running' && 'glow-run'
                  )}
                />
                <span className="font-mono">{tabLabel(key)}</span>
                <button
                  title="关闭"
                  aria-label="关闭终端"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(key)
                  }}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/tab:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* terminal body — solid dark surface; matches xterm bg (no seam) */}
      <div className="relative min-h-0 flex-1 bg-[#0c0f16]">
        {projectTabs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/25">
            <SquareTerminal className="h-7 w-7" strokeWidth={1.25} />
            <p className="text-xs">终端将显示脚本的实时输出</p>
          </div>
        ) : (
          <>
            {projectTabs.map((key) => (
              <div key={key} className="absolute inset-0">
                <TerminalView sessionKey={key} visible={activeKey === key} />
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
