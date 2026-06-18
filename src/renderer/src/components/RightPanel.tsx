import type { JSX, ReactNode, DragEvent, WheelEvent } from 'react'
import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { X, SquareTerminal, Play, FileCog, Terminal, ChevronDown } from 'lucide-react'
import { TerminalRunMenu } from '@/components/TerminalRunMenu'
import { TerminalView } from '@/components/Terminal/TerminalView'
import { EnvEditor } from '@/components/Env/EnvEditor'
import type { Project, ScriptDef } from '@shared/types'

function tabLabel(key: string): string {
  return key.split('::')[1]?.split('#')[1] ?? key
}
function fileName(p: string): string {
  return p.split('/').pop() ?? p
}

const DOT: Record<string, string> = {
  running: 'bg-run',
  starting: 'bg-warn',
  errored: 'bg-destructive'
}

function findDef(projects: Project[], key: string): { projectId: string; def: ScriptDef } | null {
  const [projectId, scriptId] = key.split('::')
  const project = projects.find((p) => p.id === projectId)
  if (!project) return null
  for (const ws of project.workspaces) {
    const def = ws.scripts.find((s) => s.id === scriptId)
    if (def) return { projectId, def }
  }
  return null
}

function NotStarted({ projectId, def }: { projectId: string; def: ScriptDef }): JSX.Element {
  const startScript = useAppStore((s) => s.startScript)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5 text-muted-foreground">
        <SquareTerminal className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-sm font-medium text-foreground">{def.name}</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">{def.command}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => startScript(projectId, def.id)}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition-all hover:bg-foreground/90 active:scale-95"
        >
          <Play className="h-3.5 w-3.5" /> 启动脚本
        </button>
        <TerminalRunMenu projectId={projectId} scriptId={def.id} align="center">
          <button
            title="在外部终端运行"
            aria-label="在外部终端运行"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          >
            <Terminal className="h-3.5 w-3.5" /> 外部终端 <ChevronDown className="h-3 w-3" />
          </button>
        </TerminalRunMenu>
      </div>
      <p className="text-[11px] text-muted-foreground/70">尚未运行 · 启动后这里显示实时输出</p>
    </div>
  )
}

function Tab({
  active,
  onClick,
  onClose,
  children
}: {
  active: boolean
  onClick: () => void
  onClose?: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <div
      onClick={onClick}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault() // 阻止中键触发自动滚动
      }}
      onAuxClick={(e) => {
        if (e.button === 1 && onClose) {
          e.preventDefault()
          onClose()
        }
      }}
      className={cn(
        'group/tab flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      {children}
    </div>
  )
}

// tab 最左图标槽位：默认显示类型 icon，hover tab 时原位切换为关闭按钮（关闭按钮自带 hover 态）
function TabIcon({ icon, onClose }: { icon: ReactNode; onClose: () => void }): JSX.Element {
  return (
    <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="flex items-center justify-center transition-opacity group-hover/tab:opacity-0">
        {icon}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="关闭"
        className="absolute inset-0 flex items-center justify-center rounded text-muted-foreground opacity-0 transition-all hover:bg-foreground/15 hover:text-foreground group-hover/tab:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

// tab 右侧状态灯（仅终端）
function StatusDot({ status }: { status?: string }): JSX.Element {
  return (
    <span
      className={cn(
        'h-1.5 w-1.5 shrink-0 rounded-full',
        DOT[status ?? ''] ?? 'bg-idle',
        status === 'running' && 'glow-run breathe'
      )}
    />
  )
}

export function RightPanel({ project }: { project: Project }): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const openEnvPaths = useAppStore((s) => s.openEnvPaths)
  const projects = useAppStore((s) => s.projects)
  const selectedScriptId = useAppStore((s) => s.selectedScriptId)
  const activeEnvPath = useAppStore((s) => s.activeEnvPath)
  const openTab = useAppStore((s) => s.openTab)
  const openEnvFile = useAppStore((s) => s.openEnvFile)
  const closeTab = useAppStore((s) => s.closeTab)
  const closeEnv = useAppStore((s) => s.closeEnv)
  const sessions = useAppStore((s) => s.sessions)
  const reorderTabs = useAppStore((s) => s.reorderTabs)
  const reorderEnvTabs = useAppStore((s) => s.reorderEnvTabs)

  const [tabDrag, setTabDrag] = useState<{ id: string; group: 'term' | 'env' } | null>(null)
  const [dropTab, setDropTab] = useState<{ id: string; pos: 'before' | 'after' } | null>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const projectId = project.id
  const termTabs = openTabs.filter((k) => k.startsWith(projectId + '::'))
  const envTabs = openEnvPaths.filter((p) => p.startsWith(project.path))

  const activeTermKey = activeEnvPath
    ? undefined
    : selectedScriptId && termTabs.includes(selectedScriptId)
      ? selectedScriptId
      : termTabs.at(-1)

  const total = termTabs.length + envTabs.length
  const notStarted =
    activeTermKey && !sessions[activeTermKey] ? findDef(projects, activeTermKey) : null

  const startTabDrag = (e: DragEvent, id: string, group: 'term' | 'env'): void => {
    setTabDrag({ id, group })
    e.dataTransfer.effectAllowed = 'move'
  }
  const onTabDragOver = (e: DragEvent, id: string, group: 'term' | 'env'): void => {
    if (!tabDrag || tabDrag.group !== group) return // 只允许同组（终端/.env）内重排
    e.preventDefault()
    if (id === tabDrag.id) {
      setDropTab(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    setDropTab((cur) => (cur?.id === id && cur.pos === pos ? cur : { id, pos }))
  }
  const endTabDrag = (): void => {
    setTabDrag(null)
    setDropTab(null)
  }
  const commitTabDrop = (): void => {
    if (tabDrag && dropTab) {
      const ids = [...(tabDrag.group === 'term' ? termTabs : envTabs)]
      const from = ids.indexOf(tabDrag.id)
      if (from >= 0) {
        ids.splice(from, 1)
        let ti = ids.indexOf(dropTab.id)
        if (ti < 0) ti = ids.length
        ids.splice(dropTab.pos === 'after' ? ti + 1 : ti, 0, tabDrag.id)
        if (tabDrag.group === 'term') reorderTabs(ids)
        else reorderEnvTabs(ids)
      }
    }
    setTabDrag(null)
    setDropTab(null)
  }
  const wrapDrag = (id: string, group: 'term' | 'env', node: ReactNode): JSX.Element => (
    <div
      key={id}
      draggable
      onDragStart={(e) => startTabDrag(e, id, group)}
      onDragOver={(e) => onTabDragOver(e, id, group)}
      onDrop={(e) => {
        e.stopPropagation()
        commitTabDrop()
      }}
      onDragEnd={endTabDrag}
      className={cn('relative flex shrink-0 transition-opacity', tabDrag?.id === id && 'opacity-40')}
    >
      {dropTab?.id === id && dropTab.pos === 'before' && (
        <span className="pointer-events-none absolute inset-y-1 -left-0.5 z-10 w-0.5 rounded-full bg-brand" />
      )}
      {node}
      {dropTab?.id === id && dropTab.pos === 'after' && (
        <span className="pointer-events-none absolute inset-y-1 -right-0.5 z-10 w-0.5 rounded-full bg-brand" />
      )}
    </div>
  )

  const updateFades = (): void => {
    const el = tabBarRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }
  const onTabWheel = (e: WheelEvent): void => {
    const el = tabBarRef.current
    if (!el || e.deltaY === 0) return
    el.scrollLeft += e.deltaY // 垂直滚轮 → 横向滚动
  }
  useEffect(() => {
    updateFades()
    window.addEventListener('resize', updateFades)
    return () => window.removeEventListener('resize', updateFades)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      {/* unified tab bar — scrollbar hidden so it doesn't consume height */}
      <div className="relative shrink-0 border-b border-border bg-card/40">
        <div
          ref={tabBarRef}
          onWheel={onTabWheel}
          onScroll={updateFades}
          className="no-scrollbar flex h-9 items-center gap-1 overflow-x-auto px-1"
        >
        {total === 0 ? (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <SquareTerminal className="h-3.5 w-3.5" />
            选择脚本或 .env 文件
          </div>
        ) : (
          <>
            {termTabs.map((key) =>
              wrapDrag(
                key,
                'term',
                <Tab
                  active={activeTermKey === key}
                  onClick={() => openTab(key)}
                  onClose={() => closeTab(key)}
                >
                  <TabIcon
                    onClose={() => closeTab(key)}
                    icon={<SquareTerminal className="h-3.5 w-3.5" />}
                  />
                  <span className="font-mono">{tabLabel(key)}</span>
                  <StatusDot status={sessions[key]?.status} />
                </Tab>
              )
            )}
            {envTabs.map((p) =>
              wrapDrag(
                p,
                'env',
                <Tab
                  active={activeEnvPath === p}
                  onClick={() => openEnvFile(p)}
                  onClose={() => closeEnv(p)}
                >
                  <TabIcon onClose={() => closeEnv(p)} icon={<FileCog className="h-3.5 w-3.5" />} />
                  <span className="font-mono">{fileName(p)}</span>
                </Tab>
              )
            )}
          </>
        )}
        </div>
        {canLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card to-transparent" />
        )}
        {canRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent" />
        )}
      </div>

      {/* content — terminals + env editors kept mounted, toggled by visibility */}
      <div className="relative min-h-0 flex-1 bg-[var(--term-bg)]">
        {total === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/60">
            <SquareTerminal className="h-7 w-7" strokeWidth={1.25} />
            <p className="text-xs">选择左侧的脚本或环境变量文件</p>
          </div>
        ) : (
          <>
            {termTabs.map((key) => (
              <div key={key} className="absolute inset-0">
                <TerminalView sessionKey={key} visible={activeTermKey === key} />
              </div>
            ))}
            {envTabs.map((p) => (
              <div key={p} className="absolute inset-0">
                <EnvEditor path={p} visible={activeEnvPath === p} />
              </div>
            ))}
            {notStarted && (
              <div className="absolute inset-0 bg-[var(--term-bg)]">
                <NotStarted projectId={notStarted.projectId} def={notStarted.def} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
