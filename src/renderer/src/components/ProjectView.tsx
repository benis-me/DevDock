import type { JSX } from 'react'
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
