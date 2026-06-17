import type { JSX } from 'react'
import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { Project } from '@shared/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/hint'
import {
  MoreHorizontal,
  Trash2,
  AlertTriangle,
  Pencil,
  RefreshCw,
  FolderOpen,
  MapPin,
  Pin,
  PinOff
} from 'lucide-react'

function shortenPath(p: string): string {
  const m = p.match(/^\/Users\/[^/]+(\/.*)?$/)
  return m ? '~' + (m[1] ?? '') : p
}

export function ProjectRow({
  project,
  collapsed = false
}: {
  project: Project
  collapsed?: boolean
}): JSX.Element {
  const selected = useAppStore((s) => s.selectedProjectId === project.id)
  const selectProject = useAppStore((s) => s.selectProject)
  const removeProject = useAppStore((s) => s.removeProject)
  const renameProject = useAppStore((s) => s.renameProject)
  const rescanProject = useAppStore((s) => s.rescanProject)
  const relocateProject = useAppStore((s) => s.relocateProject)
  const setPinned = useAppStore((s) => s.setPinned)
  const runningCount = useAppStore((s) => {
    const prefix = project.id + '::'
    return Object.values(s.sessions).filter(
      (x) => x.scriptId.startsWith(prefix) && (x.status === 'running' || x.status === 'starting')
    ).length
  })

  const [renaming, setRenaming] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [draft, setDraft] = useState(project.name)

  const commitRename = (): void => {
    renameProject(project.id, draft.trim() || project.name)
    setRenaming(false)
  }
  const startRename = (): void => {
    setDraft(project.name)
    setRenaming(true)
  }

  const monogram = project.name.trim().charAt(0).toUpperCase() || '·'

  const avatar = (
    <div
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold',
        project.missing
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-muted/70 text-muted-foreground'
      )}
    >
      {project.missing ? <AlertTriangle className="h-3.5 w-3.5" /> : monogram}
    </div>
  )

  const dialogs = (
    <>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-sm">
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
            <Button onClick={commitRename}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>移除「{project.name}」？</DialogTitle>
            <DialogDescription>
              正在运行的脚本会被终止。此操作只把项目从 DevDock 列表移除，不会删除磁盘上的任何文件。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                removeProject(project.id)
                setConfirmRemove(false)
              }}
            >
              移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  if (collapsed) {
    return (
      <>
        <Hint label={project.name} side="right">
          <button
            onClick={() => selectProject(project.id)}
            onDoubleClick={startRename}
            aria-label={project.name}
            className={cn(
              'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
              selected ? 'bg-accent' : 'hover:bg-accent/50'
            )}
          >
            {selected && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand" />}
            {avatar}
            {runningCount > 0 && (
              <span className="glow-run breathe absolute right-1 top-1 h-2 w-2 rounded-full bg-run ring-2 ring-card" />
            )}
          </button>
        </Hint>
        {dialogs}
      </>
    )
  }

  return (
    <>
      <div
        onClick={() => selectProject(project.id)}
        onDoubleClick={startRename}
        title="双击重命名"
        className={cn(
          'group relative flex cursor-pointer items-center gap-2.5 rounded-md p-2 transition-colors',
          selected ? 'bg-accent' : menuOpen ? 'bg-accent/50' : 'hover:bg-accent/50'
        )}
      >
        {selected && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" />}

        {avatar}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {project.pinned && (
              <Pin className="h-3 w-3 shrink-0 -rotate-45 text-muted-foreground" />
            )}
            <span
              className={cn(
                'truncate text-[13px] font-medium',
                selected ? 'text-accent-foreground' : 'text-foreground'
              )}
            >
              {project.name}
            </span>
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">
            {shortenPath(project.path)}
          </div>
        </div>

        {runningCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-run/15 px-1.5 py-0.5 text-[10px] font-medium text-run group-hover:hidden">
            <span className="glow-run breathe h-1.5 w-1.5 rounded-full bg-run" />
            {runningCount}
          </span>
        )}

        <div
          className={cn('items-center gap-0.5', menuOpen ? 'flex' : 'hidden group-hover:flex')}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            title="移除"
            aria-label="移除项目"
            onClick={() => setConfirmRemove(true)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                title="更多"
                aria-label="更多操作"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-44 shadow-lg"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem onClick={startRename}>
                <Pencil /> 重命名
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => rescanProject(project.id)}>
                <RefreshCw /> 重新扫描
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.devdock.shell.openPath(project.path)}>
                <FolderOpen /> 打开文件夹
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPinned(project.id, !project.pinned)}>
                {project.pinned ? <PinOff /> : <Pin />} {project.pinned ? '取消置顶' : '置顶'}
              </DropdownMenuItem>
              {project.missing && (
                <DropdownMenuItem onClick={() => relocateProject(project.id)}>
                  <MapPin /> 重新定位…
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmRemove(true)}>
                <Trash2 /> 移除项目
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {dialogs}
    </>
  )
}
