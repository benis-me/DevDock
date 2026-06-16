import type { JSX } from 'react'
import { useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { ScriptList } from '@/components/ScriptList/ScriptList'
import { RightPanel } from '@/components/RightPanel'
import { OpenWith } from '@/components/OpenWith'
import { Hint } from '@/components/ui/hint'
import { RefreshCw, SquareTerminal, Plus, Play, Square, GitBranch } from 'lucide-react'

export function ProjectView(): JSX.Element {
  const project = useAppStore((s) => s.projects.find((p) => p.id === s.selectedProjectId))
  const rescan = useAppStore((s) => s.rescanProject)
  const addProject = useAppStore((s) => s.addProject)
  const sessions = useAppStore((s) => s.sessions)
  const git = useAppStore((s) => (project ? s.gitStatuses[project.id] : undefined))
  const startAllServices = useAppStore((s) => s.startAllServices)
  const stopAllInProject = useAppStore((s) => s.stopAllInProject)
  const [rescanning, setRescanning] = useState(false)

  if (!project) {
    return (
      <div className="drag flex h-full w-full flex-col items-center justify-center gap-5 px-6">
        <div className="glow-run flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <SquareTerminal className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <h1 className="text-base font-semibold tracking-tight text-foreground">DevDock</h1>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
            管理本地项目的开发脚本——一键启动、查看终端、追踪运行状态。
          </p>
        </div>
        <button
          onClick={addProject}
          className="no-drag inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> 添加项目
        </button>
      </div>
    )
  }

  const projPrefix = project.id + '::'
  const anyRunning = Object.entries(sessions).some(
    ([k, s]) => k.startsWith(projPrefix) && (s.status === 'running' || s.status === 'starting')
  )
  const hasServices = project.workspaces.some((w) =>
    w.scripts.some((d) => d.kind === 'long-running')
  )

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <header className="drag flex h-11 items-center gap-2 border-b border-border px-3">
        <Hint label={project.path} side="bottom" delay={500}>
          <div className="no-drag flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
              {project.name}
            </span>
            {project.isMonorepo && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                monorepo
              </span>
            )}
          </div>
        </Hint>
        {git?.branch && (
          <span
            className="no-drag flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"
            title={`分支 ${git.branch}${git.dirty ? ` · ${git.changes} 处未提交` : ' · 干净'}`}
          >
            <GitBranch className="h-3 w-3 shrink-0" />
            <span className="max-w-[140px] truncate">{git.branch}</span>
            {git.dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />}
          </span>
        )}
        <div className="flex-1" />
        {hasServices && (
          <Hint label="启动所有服务">
            <button
              aria-label="启动所有服务"
              onClick={() => startAllServices(project.id)}
              className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-run/15 hover:text-run active:scale-95"
            >
              <Play className="h-4 w-4" />
            </button>
          </Hint>
        )}
        {anyRunning && (
          <Hint label="停止全部">
            <button
              aria-label="停止全部"
              onClick={() => stopAllInProject(project.id)}
              className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive active:scale-95"
            >
              <Square className="h-4 w-4" />
            </button>
          </Hint>
        )}
        <Hint label="重新扫描">
          <button
            aria-label="重新扫描"
            disabled={rescanning}
            onClick={async () => {
              setRescanning(true)
              try {
                await rescan(project.id)
              } finally {
                setRescanning(false)
              }
            }}
            className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', rescanning && 'animate-spin')} />
          </button>
        </Hint>
        <OpenWith path={project.path} />
      </header>

      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal" autoSaveId="devdock-main">
          <Panel defaultSize={42} minSize={24} className="flex">
            <ScriptList project={project} />
          </Panel>
          <PanelResizeHandle className="resize-handle" />
          <Panel minSize={30} className="flex">
            <RightPanel project={project} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
