import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { ProjectRow } from './ProjectRow'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Hint } from '@/components/ui/hint'
import { Plus, FolderPlus } from 'lucide-react'

export function Sidebar({ collapsed = false }: { collapsed?: boolean }): JSX.Element {
  const projects = useAppStore((s) => s.projects)
  const addProject = useAppStore((s) => s.addProject)

  if (collapsed) {
    return (
      <aside className="sheen flex h-full w-full flex-col items-center overflow-hidden bg-card/60">
        <div className="drag h-9 w-full shrink-0" />
        <Hint label="添加项目" side="right">
          <button
            onClick={addProject}
            aria-label="添加项目"
            className="no-drag mb-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-90"
          >
            <Plus className="h-4 w-4" />
          </button>
        </Hint>
        <div className="no-scrollbar flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden py-1">
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} collapsed />
          ))}
        </div>
        <div className="flex w-full justify-center border-t border-border py-2">
          <ThemeToggle collapsed />
        </div>
      </aside>
    )
  }

  return (
    <aside className="sheen flex h-full w-full flex-col overflow-hidden bg-card/60">
      {/* drag strip — clears the macOS traffic lights and lets the window be dragged */}
      <div className="drag h-9 shrink-0" />

      {/* section header */}
      <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          项目
        </span>
        <Hint label="添加项目">
          <button
            onClick={addProject}
            aria-label="添加项目"
            className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-90"
          >
            <Plus className="h-4 w-4" />
          </button>
        </Hint>
      </div>

      {/* project list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
      </div>

      {/* footer — theme toggle bottom-left */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <ThemeToggle />
        <span className="font-mono text-[10px] text-muted-foreground/60">v0.1.0</span>
      </div>
    </aside>
  )
}
