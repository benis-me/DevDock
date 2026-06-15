import type { JSX } from 'react'
import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { ProjectView } from '@/components/ProjectView'
import { Toaster } from '@/components/ui/sonner'

export default function App(): JSX.Element {
  const init = useAppStore((s) => s.init)
  useEffect(() => {
    init()
  }, [init])

  return (
    <div className="flex h-screen w-screen select-none overflow-hidden bg-background text-[13px] text-foreground antialiased">
      <Sidebar />
      <ProjectView />
      <Toaster position="bottom-right" />
    </div>
  )
}
