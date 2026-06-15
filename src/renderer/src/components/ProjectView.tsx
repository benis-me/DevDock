import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { ScriptList } from '@/components/ScriptList/ScriptList'
import { TerminalDock } from '@/components/Terminal/TerminalDock'
import { EnvEditor } from '@/components/Env/EnvEditor'
import { RefreshCw, FolderOpen, SquareTerminal, Plus } from 'lucide-react'

export function ProjectView(): JSX.Element {
  const project = useAppStore((s) => s.projects.find((p) => p.id === s.selectedProjectId))
  const rescan = useAppStore((s) => s.rescanProject)
  const addProject = useAppStore((s) => s.addProject)
  const activeEnvPath = useAppStore((s) => s.activeEnvPath)

  if (!project) {
    return (
      <div className="drag flex flex-1 flex-col items-center justify-center gap-5 px-6">
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

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="drag flex h-11 items-center gap-2 border-b border-border px-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
              {project.name}
            </span>
            {project.isMonorepo && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                monorepo
              </span>
            )}
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{project.path}</div>
        </div>
        <button
          title="重新扫描"
          aria-label="重新扫描"
          onClick={() => rescan(project.id)}
          className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          title="打开文件夹"
          aria-label="打开文件夹"
          onClick={() => window.devdock.shell.openPath(project.path)}
          className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <FolderOpen className="h-4 w-4" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <ScriptList project={project} />
        {activeEnvPath ? <EnvEditor path={activeEnvPath} /> : <TerminalDock />}
      </div>
    </div>
  )
}
