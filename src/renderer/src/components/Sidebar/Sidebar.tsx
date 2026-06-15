import type { JSX } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { ProjectRow } from './ProjectRow'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

export function Sidebar(): JSX.Element {
  const projects = useAppStore((s) => s.projects)
  const addProject = useAppStore((s) => s.addProject)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-card/40">
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="pl-14 font-semibold">DevDock</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={addProject}
          title="添加项目"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {projects.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">点击右上角 + 添加项目文件夹</p>
          ) : (
            projects.map((p) => <ProjectRow key={p.id} project={p} />)
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
