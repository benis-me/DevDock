import type { JSX } from 'react'
import type { Project, WorkspacePkg } from '@shared/types'
import { ScriptItem } from './ScriptItem'
import { ScrollArea } from '@/components/ui/scroll-area'

function Group({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-3">
      <div className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function WorkspaceBlock({ project, ws }: { project: Project; ws: WorkspacePkg }): JSX.Element {
  const longRunning = ws.scripts.filter((s) => s.kind === 'long-running')
  const oneShot = ws.scripts.filter((s) => s.kind === 'one-shot')
  return (
    <div className="mb-4">
      {project.isMonorepo && (
        <div className="mb-2 text-sm font-semibold">{ws.name} <span className="text-xs text-muted-foreground">{ws.relPath}</span></div>
      )}
      {longRunning.length > 0 && (
        <Group title="服务">
          {longRunning.map((s) => (
            <ScriptItem key={s.id} projectId={project.id} def={s} />
          ))}
        </Group>
      )}
      {oneShot.length > 0 && (
        <Group title="任务">
          {oneShot.map((s) => (
            <ScriptItem key={s.id} projectId={project.id} def={s} />
          ))}
        </Group>
      )}
    </div>
  )
}

export function ScriptList({ project }: { project: Project }): JSX.Element {
  if (project.missing) {
    return (
      <div className="flex w-1/2 items-center justify-center border-r p-6 text-center text-sm text-muted-foreground">
        项目目录不存在，请通过右键菜单「重新定位」或移除该项目。
      </div>
    )
  }
  return (
    <ScrollArea className="w-1/2 shrink-0 border-r">
      <div className="p-3">
        {project.workspaces.map((ws) => (
          <WorkspaceBlock key={ws.relPath} project={project} ws={ws} />
        ))}
      </div>
    </ScrollArea>
  )
}
