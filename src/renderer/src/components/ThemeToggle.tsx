import type { JSX } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { Hint } from '@/components/ui/hint'
import type { ThemeMode } from '@shared/types'

const MODES: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: '浅色' },
  { mode: 'dark', icon: Moon, label: '深色' },
  { mode: 'system', icon: Monitor, label: '跟随系统' }
]

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }): JSX.Element {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  if (collapsed) {
    const idx = Math.max(
      0,
      MODES.findIndex((m) => m.mode === theme)
    )
    const cur = MODES[idx]
    const Icon = cur.icon
    const next = MODES[(idx + 1) % MODES.length].mode
    return (
      <Hint label={`主题：${cur.label}`} side="right">
        <button
          onClick={() => setTheme(next)}
          aria-label="切换主题"
          className="no-drag flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-90"
        >
          <Icon className="h-4 w-4" />
        </button>
      </Hint>
    )
  }

  return (
    <div className="no-drag flex items-center gap-0.5 rounded-md bg-muted/70 p-0.5">
      {MODES.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          title={label}
          aria-label={label}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded transition-colors',
            theme === mode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
