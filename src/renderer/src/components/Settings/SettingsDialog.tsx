import type { JSX, ReactNode, ComponentType } from 'react'
import { useState } from 'react'
import {
  Settings as SettingsIcon,
  Minus,
  Plus,
  Palette,
  SquareTerminal,
  SlidersHorizontal,
  Plug,
  Info
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Hint } from '@/components/ui/hint'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PortTool } from './PortTool'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

const FONT_MIN = 9
const FONT_MAX = 20

type SectionId = 'appearance' | 'terminal' | 'behavior' | 'ports' | 'about'

const NAV: { id: SectionId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'terminal', label: '终端', icon: SquareTerminal },
  { id: 'behavior', label: '行为', icon: SlidersHorizontal },
  { id: 'ports', label: '端口工具', icon: Plug },
  { id: 'about', label: '关于', icon: Info }
]

function Card({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/70 bg-muted/20">
      {children}
    </div>
  )
}

function Row({
  title,
  desc,
  children
}: {
  title: string
  desc?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-4 px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{title}</div>
        {desc && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  unit,
  onChange
}: {
  value: number
  min: number
  max: number
  unit?: string
  onChange: (v: number) => void
}): JSX.Element {
  const btn =
    'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40'
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-background p-0.5">
      <button
        className={btn}
        aria-label="减小"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-12 text-center font-mono text-[13px] tabular-nums text-foreground">
        {value}
        {unit}
      </span>
      <button
        className={btn}
        aria-label="增大"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function SectionBody({ id }: { id: SectionId }): JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const portlessAvailable = useAppStore((s) => s.portlessAvailable)
  const versions = window.devdock.versions

  switch (id) {
    case 'appearance':
      return (
        <Card>
          <Row title="主题" desc="浅色 / 深色 / 跟随系统">
            <ThemeToggle />
          </Row>
        </Card>
      )
    case 'terminal':
      return (
        <Card>
          <Row title="字号" desc={`${FONT_MIN}–${FONT_MAX} px · 即时生效`}>
            <Stepper
              value={settings.terminalFontSize}
              min={FONT_MIN}
              max={FONT_MAX}
              unit="px"
              onChange={(v) => setSettings({ terminalFontSize: v })}
            />
          </Row>
          <Row title="光标闪烁">
            <Switch
              label="光标闪烁"
              checked={settings.terminalCursorBlink}
              onCheckedChange={(v) => setSettings({ terminalCursorBlink: v })}
            />
          </Row>
        </Card>
      )
    case 'behavior':
      return (
        <Card>
          <Row title="注入项目 .env" desc="启动脚本时合并 .env / .env.local">
            <Switch
              label="注入项目 .env"
              checked={settings.injectEnv}
              onCheckedChange={(v) => setSettings({ injectEnv: v })}
            />
          </Row>
          <Row
            title="默认用 portless 启动"
            desc={
              portlessAvailable ? '长任务未单独设置时默认走 portless' : '未检测到 portless，已禁用'
            }
          >
            <Switch
              label="默认用 portless 启动"
              disabled={!portlessAvailable}
              checked={settings.portlessDefault}
              onCheckedChange={(v) => setSettings({ portlessDefault: v })}
            />
          </Row>
          <Row title="退出前确认" desc="仍有脚本运行时退出二次确认">
            <Switch
              label="退出前确认"
              checked={settings.confirmOnQuit}
              onCheckedChange={(v) => setSettings({ confirmOnQuit: v })}
            />
          </Row>
        </Card>
      )
    case 'ports':
      return (
        <div>
          <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
            输入端口号实时查看占用进程，并可单独终止。
          </p>
          <PortTool />
        </div>
      )
    case 'about':
      return (
        <div className="flex flex-col items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <SquareTerminal className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">DevDock 0.1.0</div>
            <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-muted-foreground">
              管理本地项目的开发脚本——一键启动、查看终端、追踪运行状态。
            </p>
          </div>
          <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground/80">
            <div>Electron {versions.electron}</div>
            <div>Node {versions.node}</div>
            <div>Chromium {versions.chrome}</div>
          </div>
        </div>
      )
  }
}

export function SettingsDialog(): JSX.Element {
  const [active, setActive] = useState<SectionId>('appearance')
  const current = NAV.find((n) => n.id === active)!

  return (
    <Dialog>
      <Hint label="设置">
        <DialogTrigger
          aria-label="设置"
          className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground active:scale-90"
        >
          <SettingsIcon className="h-4 w-4" />
        </DialogTrigger>
      </Hint>

      <DialogContent className="flex h-[520px] max-h-[85vh] w-[min(700px,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden p-0">
        {/* 左侧导航 */}
        <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-muted/30 p-3">
          <DialogTitle className="px-2 pb-2 pt-1 text-[13px] font-semibold tracking-tight text-foreground">
            设置
          </DialogTitle>
          <DialogDescription className="sr-only">应用偏好设置</DialogDescription>
          <nav className="flex flex-col gap-0.5">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                  active === id
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* 右侧内容 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center border-b border-border px-5">
            <h2 className="text-[14px] font-semibold text-foreground">{current.label}</h2>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <SectionBody id={active} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
