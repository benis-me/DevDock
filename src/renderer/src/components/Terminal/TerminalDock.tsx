import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { X, SquareTerminal } from 'lucide-react'
import { TerminalView } from './TerminalView'

function tabLabel(key: string): string {
  return key.split('::')[1]?.split('#')[1] ?? key
}

const TAB_DOT: Record<string, string> = {
  running: 'bg-run',
  starting: 'bg-warn',
  errored: 'bg-destructive'
}

export function TerminalDock(): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const active = useAppStore((s) => s.selectedScriptId)
  const setActive = useAppStore((s) => s.openTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const sessions = useAppStore((s) => s.sessions)

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {/* tab strip */}
      <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-card/30">
        {openTabs.length === 0 ? (
          <div className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
            <SquareTerminal className="h-3.5 w-3.5" />
            选择脚本以查看终端
          </div>
        ) : (
          openTabs.map((key) => {
            const st = sessions[key]?.status
            const isActive = active === key
            return (
              <div
                key={key}
                onClick={() => setActive(key)}
                className={cn(
                  'group/tab flex h-full cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors',
                  isActive
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', TAB_DOT[st ?? ''] ?? 'bg-idle')} />
                <span className="font-mono">{tabLabel(key)}</span>
                <button
                  title="关闭"
                  aria-label="关闭终端"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(key)
                  }}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/tab:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* terminals — flush, no padding */}
      <div className="relative min-h-0 flex-1">
        {openTabs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50">
            终端将显示脚本的实时输出
          </div>
        ) : (
          openTabs.map((key) => (
            <div key={key} className="absolute inset-0">
              <TerminalView sessionKey={key} visible={active === key} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
