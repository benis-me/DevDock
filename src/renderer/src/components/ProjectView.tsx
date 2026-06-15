import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { ScriptList } from '@/components/ScriptList/ScriptList'
import { TerminalDock } from '@/components/Terminal/TerminalDock'
import { RefreshCw, FolderOpen, FolderGit2 } from 'lucide-react'

export function ProjectView(): JSX.Element {
  const project = useAppStore((s) => s.projects.find((p) => p.id === s.selectedProjectId))
  const rescan = useAppStore((s) => s.rescanProject)

  if (!project) {
    return (
      <div className="drag flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <FolderGit2 className="h-8 w-8 opacity-40" strokeWidth={1.5} />
        <p className="text-sm">从左侧选择，或添加一个项目</p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="drag flex h-11 items-center gap-2 border-b border-border px-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-foreground">{project.name}</span>
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
          title="在 Finder 中打开"
          aria-label="在 Finder 中打开"
          onClick={() => window.devdock.shell.revealInFinder(project.path)}
          className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <FolderOpen className="h-4 w-4" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <ScriptList project={project} />
        <TerminalDock />
      </div>
    </div>
  )
}
