import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { ProjectRow } from './ProjectRow'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SquareTerminal, Plus, FolderPlus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

export function Sidebar(): JSX.Element {
  const projects = useAppStore((s) => s.projects)
  const addProject = useAppStore((s) => s.addProject)

  return (
    <aside className="sheen flex w-64 shrink-0 flex-col border-r border-border bg-card/40">
      {/* brand / drag title bar — pl clears macOS traffic lights */}
      <div className="drag flex h-11 items-center pl-20 pr-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/12 text-brand">
            <SquareTerminal className="h-[15px] w-[15px]" strokeWidth={2.25} />
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-foreground">DevDock</span>
        </div>
      </div>

      {/* section header */}
      <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          项目
        </span>
        <button
          onClick={addProject}
          title="添加项目"
          aria-label="添加项目"
          className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* project list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {projects.length === 0 ? (
            <button
              onClick={addProject}
              className="no-drag mt-2 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-3 py-7 text-center text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
            >
              <FolderPlus className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-xs">添加项目文件夹</span>
            </button>
          ) : (
            projects.map((p) => <ProjectRow key={p.id} project={p} />)
          )}
        </div>
      </ScrollArea>

      {/* footer — theme toggle bottom-left */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <ThemeToggle />
        <span className="font-mono text-[10px] text-muted-foreground/60">v0.1.0</span>
      </div>
    </aside>
  )
}
