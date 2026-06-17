import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { sessionKey } from '@shared/util'
import { portFromUrl } from '@shared/port'
import type { ScriptDef, SessionStatus } from '@shared/types'
import { useElapsed } from './useElapsed'
import { Play, Square, RotateCw, ArrowUpRight, ChevronDown } from 'lucide-react'
import { TerminalRunMenu } from '@/components/TerminalRunMenu'

const DOT: Record<SessionStatus | 'idle', string> = {
  idle: 'bg-idle',
  starting: 'bg-warn',
  running: 'bg-run',
  exited: 'bg-idle',
  errored: 'bg-destructive'
}

function IconBtn({
  children,
  title,
  onClick,
  tone = 'default'
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  tone?: 'default' | 'danger' | 'run'
}): JSX.Element {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
        tone === 'danger'
          ? 'hover:bg-destructive/15 hover:text-destructive'
          : tone === 'run'
            ? 'hover:bg-run/15 hover:text-run'
            : 'hover:bg-accent hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

export function ScriptItem({ projectId, def }: { projectId: string; def: ScriptDef }): JSX.Element {
  const key = sessionKey(projectId, def.id)
  const session = useAppStore((s) => s.sessions[key])
  const selected = useAppStore((s) => s.selectedScriptId === key && !s.activeEnvPath)
  const openTab = useAppStore((s) => s.openTab)
  const startScript = useAppStore((s) => s.startScript)
  const stopScript = useAppStore((s) => s.stopScript)
  const restartScript = useAppStore((s) => s.restartScript)
  const explicitPortless = useAppStore((s) => s.scriptPrefs[key]?.portless)
  const portlessDefault = useAppStore((s) => s.settings.portlessDefault)
  const portless = explicitPortless ?? (portlessDefault && def.kind === 'long-running')
  const portlessAvailable = useAppStore((s) => s.portlessAvailable)
  const setPortless = useAppStore((s) => s.setPortless)

  const status: SessionStatus | 'idle' = session?.status ?? 'idle'
  const isActive = status === 'running' || status === 'starting'
  const elapsed = useElapsed(session?.startedAt, isActive)
  const port = portFromUrl(session?.url)

  return (
    <div
      onClick={() => openTab(key)}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-md p-2.5 transition-colors',
        selected ? 'bg-accent' : 'hover:bg-accent/50'
      )}
    >
      {selected && (
        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand" />
      )}

      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            DOT[status],
            status === 'starting' && 'animate-pulse',
            status === 'running' && 'glow-run breathe'
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-foreground">{def.name}</span>
            {isActive && port && (
              <span
                title={`监听端口 ${port}`}
                className="shrink-0 rounded bg-run/15 px-1 font-mono text-[10px] font-medium text-run"
              >
                :{port}
              </span>
            )}
            {isActive && session && (
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {session.pid > 0 ? `PID ${session.pid} · ` : ''}
                {elapsed}
              </span>
            )}
            {status === 'errored' && (
              <span className="shrink-0 text-[10px] font-medium text-destructive">异常退出</span>
            )}
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground/80">
            {def.command}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {def.kind === 'long-running' && portlessAvailable && (
            <button
              title={
                portless
                  ? '已启用 portless：用 https://*.localhost 启动'
                  : '用 portless 启动（干净的 *.localhost 域名，需重启脚本生效）'
              }
              onClick={() => setPortless(projectId, def.id, !portless)}
              className={cn(
                'mr-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                portless
                  ? 'bg-foreground text-background'
                  : 'border border-border text-muted-foreground hover:text-foreground'
              )}
            >
              portless
            </button>
          )}
          {isActive ? (
            <>
              <IconBtn title="重启" onClick={() => restartScript(projectId, def.id)}>
                <RotateCw className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn title="停止" tone="danger" onClick={() => stopScript(key)}>
                <Square className="h-3.5 w-3.5" />
              </IconBtn>
            </>
          ) : (
            <div className="flex items-center">
              <IconBtn title="在应用内启动" tone="run" onClick={() => startScript(projectId, def.id)}>
                <Play className="h-3.5 w-3.5" />
              </IconBtn>
              <TerminalRunMenu projectId={projectId} scriptId={def.id}>
                <button
                  title="在外部终端运行"
                  aria-label="在外部终端运行"
                  className="flex h-7 w-4 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </TerminalRunMenu>
            </div>
          )}
        </div>
      </div>

      {session?.url && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            window.devdock.shell.openExternal(session.url!)
          }}
          className="mt-1.5 ml-[18px] flex items-center gap-1 font-mono text-[11px] text-brand hover:underline"
        >
          {session.url}
          <ArrowUpRight className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
