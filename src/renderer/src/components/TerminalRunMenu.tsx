import type { JSX, ReactNode } from 'react'
import { useAppStore } from '@/store/useAppStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Terminal } from 'lucide-react'
import type { AppInfo } from '@shared/types'

// 包裹任意触发元素，弹出「在外部终端运行」菜单。检测不到终端时不渲染（返回 null）。
export function TerminalRunMenu({
  projectId,
  scriptId,
  children,
  align = 'end'
}: {
  projectId: string
  scriptId: string
  children: ReactNode
  align?: 'start' | 'center' | 'end'
}): JSX.Element | null {
  const apps = useAppStore((s) => s.apps)
  const run = useAppStore((s) => s.runInTerminal)
  const terminals = apps.filter((a: AppInfo) => a.kind === 'terminal')
  if (terminals.length === 0) return null

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={6}
        className="w-52"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel>在外部终端运行</DropdownMenuLabel>
        {terminals.map((a) => (
          <DropdownMenuItem key={a.id} onClick={() => run(projectId, scriptId, a.id)}>
            {a.icon ? (
              <img src={a.icon} alt="" className="h-4 w-4 shrink-0 rounded-[3px]" />
            ) : (
              <Terminal className="h-4 w-4 shrink-0" />
            )}
            {a.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
