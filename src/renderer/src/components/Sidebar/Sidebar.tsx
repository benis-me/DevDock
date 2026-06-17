import type { JSX, DragEvent } from 'react'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { ProjectRow } from './ProjectRow'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SettingsDialog } from '@/components/Settings/SettingsDialog'
import { Hint } from '@/components/ui/hint'
import { cn } from '@/lib/utils'
import { Plus, FolderPlus, PanelLeftClose } from 'lucide-react'
import type { Project } from '@shared/types'

// pinned first, preserving array order within each group (Array.sort is stable)
function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))
}

export function Sidebar({
  collapsed = false,
  onToggle
}: {
  collapsed?: boolean
  onToggle?: () => void
}): JSX.Element {
  const projects = useAppStore((s) => s.projects)
  const addProject = useAppStore((s) => s.addProject)
  const addProjectByPath = useAppStore((s) => s.addProjectByPath)
  const reorderProjects = useAppStore((s) => s.reorderProjects)

  const [dropActive, setDropActive] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const ordered = sortProjects(projects)

  const onFolderDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDropActive(false)
    for (const f of Array.from(e.dataTransfer.files)) {
      const p = window.devdock.getPathForFile(f) || (f as unknown as { path?: string }).path
      if (p) addProjectByPath(p)
    }
  }
  const onAsideDragOver = (e: DragEvent): void => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      setDropActive(true)
    }
  }

  const handleRowDrop = (targetId: string): void => {
    if (!dragId || dragId === targetId) return
    const ids = projects.map((p) => p.id).filter((id) => id !== dragId)
    const ti = ids.indexOf(targetId)
    ids.splice(ti < 0 ? ids.length : ti, 0, dragId)
    reorderProjects(ids)
    setDragId(null)
  }

  if (collapsed) {
    return (
      <aside className="sheen flex h-full w-full flex-col items-center overflow-hidden bg-card/60">
        <div className="drag h-11 w-full shrink-0" />
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
          {ordered.map((p) => (
            <ProjectRow key={p.id} project={p} collapsed />
          ))}
        </div>
        <div className="flex w-full flex-col items-center gap-1 border-t border-border py-2">
          <ThemeToggle collapsed />
          <SettingsDialog />
        </div>
      </aside>
    )
  }

  return (
    <aside
      onDragOver={onAsideDragOver}
      onDragLeave={() => setDropActive(false)}
      onDrop={onFolderDrop}
      className={cn(
        'sheen flex h-full w-full flex-col overflow-hidden bg-card/60',
        dropActive && 'ring-2 ring-inset ring-brand/60'
      )}
    >
      <div className="drag h-9 shrink-0" />

      <div className="flex items-center justify-between py-1.5 pl-3.5 pr-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          项目
        </span>
        <div className="flex items-center gap-0.5">
          <Hint label="添加项目">
            <button
              onClick={addProject}
              aria-label="添加项目"
              className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </Hint>
          <Hint label="收起侧栏">
            <button
              onClick={onToggle}
              aria-label="收起侧栏"
              className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-90"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </Hint>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {projects.length === 0 ? (
            <button
              onClick={addProject}
              className="no-drag mt-2 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-3 py-7 text-center text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
            >
              <FolderPlus className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-xs">添加项目 · 或把文件夹拖到这里</span>
            </button>
          ) : (
            ordered.map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => {
                  setDragId(p.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (dragId) e.preventDefault()
                }}
                onDrop={(e) => {
                  if (dragId) {
                    e.stopPropagation()
                    handleRowDrop(p.id)
                  }
                }}
                onDragEnd={() => setDragId(null)}
                className={cn('rounded-md transition-opacity', dragId === p.id && 'opacity-40')}
              >
                <ProjectRow project={p} />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border p-2.5">
        <ThemeToggle />
        <SettingsDialog />
      </div>
    </aside>
  )
}
