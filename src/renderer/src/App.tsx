import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle
} from 'react-resizable-panels'
import { useAppStore } from '@/store/useAppStore'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { ProjectView } from '@/components/ProjectView'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App(): JSX.Element {
  const init = useAppStore((s) => s.init)
  useEffect(() => {
    init()
  }, [init])

  const [collapsed, setCollapsed] = useState(false)
  const sidebarRef = useRef<ImperativePanelHandle>(null)
  // sync collapsed state from the restored layout on mount
  useEffect(() => {
    setCollapsed(!!sidebarRef.current?.isCollapsed())
  }, [])

  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={120}>
      <div className="h-screen w-screen select-none overflow-hidden bg-background text-[13px] text-foreground antialiased">
        <PanelGroup direction="horizontal" autoSaveId="devdock-shell" className="h-full w-full">
          <Panel
            ref={sidebarRef}
            id="sidebar"
            order={1}
            collapsible
            collapsedSize={5}
            minSize={13}
            maxSize={30}
            defaultSize={19}
            onCollapse={() => setCollapsed(true)}
            onExpand={() => setCollapsed(false)}
            className="flex"
          >
            <Sidebar collapsed={collapsed} />
          </Panel>
          <PanelResizeHandle className="resize-handle" />
          <Panel id="main" order={2} minSize={40} className="flex">
            <ProjectView />
          </Panel>
        </PanelGroup>
        <Toaster position="bottom-right" />
      </div>
    </TooltipProvider>
  )
}
