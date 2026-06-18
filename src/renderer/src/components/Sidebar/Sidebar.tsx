import type { JSX, DragEvent } from 'react'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { ProjectRow } from './ProjectRow'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SettingsDialog } from '@/components/Settings/SettingsDialog'
import { Hint } from '@/components/ui/hint'
import { cn } from '@/lib/utils'
import { Plus, FolderPlus, PanelLeftClose, Search, X } from 'lucide-react'
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
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: 'before' | 'after' } | null>(null)
  const [query, setQuery] = useState('')

  const ordered = sortProjects(projects)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? ordered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.workspaces.some((w) => w.scripts.some((s) => s.name.toLowerCase().includes(q)))
      )
    : ordered

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

  const commitRowDrop = (): void => {
    if (dragId && dropTarget) {
      const ids = ordered.map((p) => p.id)
      const from = ids.indexOf(dragId)
      if (from >= 0) {
        ids.splice(from, 1)
        let ti = ids.indexOf(dropTarget.id)
        if (ti < 0) ti = ids.length
        ids.splice(dropTarget.pos === 'after' ? ti + 1 : ti, 0, dragId)
        reorderProjects(ids)
      }
    }
    setDragId(null)
    setDropTarget(null)
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
          <SettingsDialog side="right" />
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
      <div className="drag flex h-11 shrink-0 items-center justify-end pr-3">
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

      <div className="flex items-center justify-between py-1.5 pl-3.5 pr-3">
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

      {projects.length > 0 && (
        <div className="px-2 pb-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索项目 / 脚本"
              className="no-drag h-7 w-full rounded-md border border-border bg-transparent pl-7 pr-6 text-xs text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="清除搜索"
                className="no-drag absolute right-1.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded text-muted-foreground/60 transition hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

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
          ) : filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">无匹配的项目</p>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                draggable={!q}
                onDragStart={(e) => {
                  setDragId(p.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (!dragId) return
                  e.preventDefault()
                  if (p.id === dragId) {
                    setDropTarget(null)
                    return
                  }
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                  setDropTarget((cur) =>
                    cur?.id === p.id && cur.pos === pos ? cur : { id: p.id, pos }
                  )
                }}
                onDrop={(e) => {
                  if (dragId) {
                    e.stopPropagation()
                    commitRowDrop()
                  }
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setDropTarget(null)
                }}
                className={cn(
                  'relative rounded-md transition-opacity',
                  dragId === p.id && 'opacity-40'
                )}
              >
                {dropTarget?.id === p.id && dropTarget.pos === 'before' && (
                  <span className="pointer-events-none absolute inset-x-1 -top-px z-10 h-0.5 rounded-full bg-brand" />
                )}
                <ProjectRow project={p} />
                {dropTarget?.id === p.id && dropTarget.pos === 'after' && (
                  <span className="pointer-events-none absolute inset-x-1 -bottom-px z-10 h-0.5 rounded-full bg-brand" />
                )}
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
