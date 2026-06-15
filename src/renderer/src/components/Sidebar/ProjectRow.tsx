import type { JSX } from 'react'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { Project } from '@shared/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MoreVertical, AlertTriangle } from 'lucide-react'

export function ProjectRow({ project }: { project: Project }): JSX.Element {
  const selected = useAppStore((s) => s.selectedProjectId === project.id)
  const selectProject = useAppStore((s) => s.selectProject)
  const removeProject = useAppStore((s) => s.removeProject)
  const renameProject = useAppStore((s) => s.renameProject)
  const rescanProject = useAppStore((s) => s.rescanProject)
  const relocateProject = useAppStore((s) => s.relocateProject)
  const runningCount = useAppStore((s) => {
    const prefix = project.id + '::'
    return Object.values(s.sessions).filter(
      (x) => x.scriptId.startsWith(prefix) && (x.status === 'running' || x.status === 'starting')
    ).length
  })

  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(project.name)

  const commitRename = (): void => {
    renameProject(project.id, draft.trim() || project.name)
    setRenaming(false)
  }

  return (
    <>
      <div
        onClick={() => selectProject(project.id)}
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5',
          selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate font-medium">
            {project.missing && <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />}
            {project.name}
          </div>
          <div className="truncate text-xs text-muted-foreground">{project.path}</div>
        </div>
        {runningCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
            {runningCount}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={() => {
                setDraft(project.name)
                setRenaming(true)
              }}
            >
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => rescanProject(project.id)}>重扫</DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.devdock.shell.revealInFinder(project.path)}>
              在 Finder 显示
            </DropdownMenuItem>
            {project.missing && (
              <DropdownMenuItem onClick={() => relocateProject(project.id)}>
                重新定位…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm(`移除项目「${project.name}」？正在运行的脚本会被终止。`)) {
                  removeProject(project.id)
                }
              }}
            >
              移除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              取消
            </Button>
            <Button onClick={commitRename}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
