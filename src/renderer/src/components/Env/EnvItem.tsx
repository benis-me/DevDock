import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { EnvFile } from '@shared/types'
import { FileCog } from 'lucide-react'

export function EnvItem({ file }: { file: EnvFile }): JSX.Element {
  const selected = useAppStore((s) => s.activeEnvPath === file.path)
  const openEnvFile = useAppStore((s) => s.openEnvFile)

  return (
    <div
      onClick={() => openEnvFile(file.path)}
      className={cn(
        'group relative flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-md p-2.5 transition-colors',
        selected ? 'bg-accent' : 'hover:bg-accent/50'
      )}
    >
      {selected && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand" />}
      <FileCog className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">
        {file.name}
      </span>
      {file.relPath !== '.' && (
        <span className="shrink-0 truncate font-mono text-[10px] text-muted-foreground">
          {file.relPath}
        </span>
      )}
    </div>
  )
}
