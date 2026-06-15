import type { JSX } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { ThemeMode } from '@shared/types'

const MODES: { mode: ThemeMode; icon: typeof Sun }[] = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'system', icon: Monitor }
]

export function ThemeToggle(): JSX.Element {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  return (
    <div className="flex items-center gap-0.5 rounded-md border p-0.5">
      {MODES.map(({ mode, icon: Icon }) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground',
            theme === mode && 'bg-accent text-accent-foreground'
          )}
          title={mode}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
