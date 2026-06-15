import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { sessionKey } from '@shared/util'
import type { ScriptDef, SessionStatus } from '@shared/types'
import { useElapsed } from './useElapsed'
import { Play, Square, RotateCw, ExternalLink } from 'lucide-react'

const DOT: Record<SessionStatus | 'idle', string> = {
  idle: 'bg-muted-foreground/40',
  starting: 'bg-amber-500 animate-pulse',
  running: 'bg-emerald-500',
  exited: 'bg-muted-foreground/40',
  errored: 'bg-destructive'
}

export function ScriptItem({ projectId, def }: { projectId: string; def: ScriptDef }): JSX.Element {
  const key = sessionKey(projectId, def.id)
  const session = useAppStore((s) => s.sessions[key])
  const selected = useAppStore((s) => s.selectedScriptId === key)
  const openTab = useAppStore((s) => s.openTab)
  const startScript = useAppStore((s) => s.startScript)
  const stopScript = useAppStore((s) => s.stopScript)
  const restartScript = useAppStore((s) => s.restartScript)

  const status: SessionStatus | 'idle' = session?.status ?? 'idle'
  const isActive = status === 'running' || status === 'starting'
  const elapsed = useElapsed(session?.startedAt, isActive)

  return (
    <div
      onClick={() => openTab(key)}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2',
        selected ? 'border-ring bg-accent/60' : 'hover:bg-accent/40'
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT[status])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{def.name}</span>
          {isActive && session && (
            <span className="text-xs text-muted-foreground">PID {session.pid} · {elapsed}</span>
          )}
          {status === 'errored' && <span className="text-xs text-destructive">异常退出</span>}
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground">{def.command}</div>
        {session?.url && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.devdock.shell.openExternal(session.url!)
            }}
            className="mt-0.5 flex items-center gap-1 text-xs text-blue-500 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {session.url}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {isActive ? (
          <>
            <button title="重启" onClick={() => restartScript(projectId, def.id)}>
              <RotateCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
            <button title="停止" onClick={() => stopScript(key)}>
              <Square className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </>
        ) : (
          <button title="启动" onClick={() => startScript(projectId, def.id)}>
            <Play className="h-4 w-4 text-muted-foreground hover:text-emerald-500" />
          </button>
        )}
      </div>
    </div>
  )
}
