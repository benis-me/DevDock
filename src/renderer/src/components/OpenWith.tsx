import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Hint } from '@/components/ui/hint'
import { ChevronDown, FolderOpen } from 'lucide-react'
import type { AppInfo } from '@shared/types'

function AppGlyph({ app }: { app: AppInfo }): JSX.Element {
  return app.icon ? (
    <img src={app.icon} alt="" className="h-4 w-4 shrink-0 rounded-[3px]" />
  ) : (
    <FolderOpen className="h-4 w-4 shrink-0" />
  )
}

export function OpenWith({ path }: { path: string }): JSX.Element {
  const apps = useAppStore((s) => s.apps)
  const openWithDefault = useAppStore((s) => s.openWithDefault)
  const openWith = useAppStore((s) => s.openWith)

  if (apps.length === 0) {
    return (
      <Hint label="打开文件夹">
        <button
          onClick={() => window.devdock.shell.openPath(path)}
          aria-label="打开文件夹"
          className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-95"
        >
          <FolderOpen className="h-4 w-4" />
        </button>
      </Hint>
    )
  }

  const def =
    apps.find((a) => a.id === openWithDefault) ?? apps.find((a) => a.id === 'finder') ?? apps[0]
  const editors = apps.filter((a) => a.kind === 'editor')
  const terminals = apps.filter((a) => a.kind === 'terminal')
  const others = apps.filter((a) => a.kind === 'other')

  const item = (a: AppInfo): JSX.Element => (
    <DropdownMenuItem key={a.id} onClick={() => openWith(a.id, path)}>
      <AppGlyph app={a} />
      {a.name}
    </DropdownMenuItem>
  )

  return (
    <div className="no-drag flex items-center overflow-hidden rounded-md border border-border">
      <Hint label={`用 ${def.name} 打开`}>
        <button
          onClick={() => openWith(def.id, path)}
          aria-label={`用 ${def.name} 打开`}
          className="flex h-7 items-center px-2 text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-[0.97]"
        >
          <AppGlyph app={def} />
        </button>
      </Hint>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="选择打开方式"
            className="flex h-7 w-6 items-center justify-center border-l border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-48"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {editors.length > 0 && <DropdownMenuLabel>编辑器</DropdownMenuLabel>}
          {editors.map(item)}
          {terminals.length > 0 && (
            <>
              {editors.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>终端</DropdownMenuLabel>
            </>
          )}
          {terminals.map(item)}
          {others.length > 0 && <DropdownMenuSeparator />}
          {others.map(item)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
