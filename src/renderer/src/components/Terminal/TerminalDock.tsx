import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { TerminalView } from './TerminalView'

function tabLabel(key: string): string {
  return key.split('::')[1]?.split('#')[1] ?? key
}

export function TerminalDock(): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const active = useAppStore((s) => s.selectedScriptId)
  const setActive = useAppStore((s) => s.openTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const sessions = useAppStore((s) => s.sessions)

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-card/20">
      <div className="flex h-8 items-center gap-0.5 overflow-x-auto border-b px-1">
        {openTabs.length === 0 && (
          <span className="px-2 text-xs text-muted-foreground">选择脚本以打开终端</span>
        )}
        {openTabs.map((key) => {
          const st = sessions[key]?.status
          return (
            <div
              key={key}
              onClick={() => setActive(key)}
              className={cn(
                'flex h-6 cursor-pointer items-center gap-1.5 rounded px-2 text-xs',
                active === key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  st === 'running' ? 'bg-emerald-500' : st === 'starting' ? 'bg-amber-500' : st === 'errored' ? 'bg-destructive' : 'bg-muted-foreground/40'
                )}
              />
              {tabLabel(key)}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(key)
                }}
              >
                <X className="h-3 w-3 hover:text-foreground" />
              </button>
            </div>
          )
        })}
      </div>
      <div className="relative flex-1 overflow-hidden p-1">
        {openTabs.map((key) => (
          <div key={key} className="absolute inset-1">
            <TerminalView sessionKey={key} visible={active === key} />
          </div>
        ))}
      </div>
    </div>
  )
}
