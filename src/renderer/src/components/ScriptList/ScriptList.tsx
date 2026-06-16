import { useState } from 'react'
import type { JSX } from 'react'
import type { Project, WorkspacePkg } from '@shared/types'
import { ScriptItem } from './ScriptItem'
import { EnvItem } from '@/components/Env/EnvItem'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronDown, FileWarning } from 'lucide-react'

function Group({
  title,
  count,
  children
}: {
  title: string
  count: number
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground/60">{count}</span>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

function WorkspaceBlock({ project, ws }: { project: Project; ws: WorkspacePkg }): JSX.Element | null {
  const [collapsed, setCollapsed] = useState(false)
  if (ws.scripts.length === 0) return null
  const longRunning = ws.scripts.filter((s) => s.kind === 'long-running')
  const oneShot = ws.scripts.filter((s) => s.kind === 'one-shot')

  return (
    <div className="mb-5 last:mb-0">
      {project.isMonorepo && (
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mb-2 flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-accent/40"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="text-[13px] font-semibold">{ws.name}</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">{ws.relPath}</span>
        </button>
      )}
      {!collapsed && (
        <div className={cn(project.isMonorepo && 'pl-2')}>
          {longRunning.length > 0 && (
            <Group title="服务" count={longRunning.length}>
              {longRunning.map((s) => (
                <ScriptItem key={s.id} projectId={project.id} def={s} />
              ))}
            </Group>
          )}
          {oneShot.length > 0 && (
            <Group title="任务" count={oneShot.length}>
              {oneShot.map((s) => (
                <ScriptItem key={s.id} projectId={project.id} def={s} />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  )
}

export function ScriptList({ project }: { project: Project }): JSX.Element {
  if (project.missing) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <FileWarning className="h-7 w-7 text-destructive/70" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">项目目录不存在</p>
        <p className="text-xs text-muted-foreground/70">通过右键菜单「重新定位」或移除该项目</p>
      </div>
    )
  }

  const noScripts = project.workspaces.every((w) => w.scripts.length === 0)
  const envFiles = project.envFiles ?? []

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      <div className="p-3">
        {!noScripts &&
          project.workspaces.map((ws) => (
            <WorkspaceBlock key={ws.relPath} project={project} ws={ws} />
          ))}

        {envFiles.length > 0 && (
          <div className="mb-4 last:mb-0">
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                环境变量
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground/60">
                {envFiles.length}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {envFiles.map((f) => (
                <EnvItem key={f.path} file={f} />
              ))}
            </div>
          </div>
        )}

        {noScripts && envFiles.length === 0 && (
          <p className="px-1 py-10 text-center text-xs text-muted-foreground">
            未发现脚本或 .env 文件
          </p>
        )}
      </div>
    </div>
  )
}
