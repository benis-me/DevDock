import type { JSX, ReactNode, ComponentType } from 'react'
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
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Hint } from '@/components/ui/hint'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PortTool } from './PortTool'
import { useAppStore } from '@/store/useAppStore'

const FONT_MIN = 9
const FONT_MAX = 20

function Section({
  icon: Icon,
  label,
  children
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  children: ReactNode
}): JSX.Element {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/70 bg-muted/20">
        {children}
      </div>
    </section>
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
    <div className="flex min-h-[46px] items-center justify-between gap-4 px-3 py-2.5">
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

export function SettingsDialog(): JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const portlessAvailable = useAppStore((s) => s.portlessAvailable)
  const versions = window.devdock.versions

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

      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px]">设置</DialogTitle>
          <DialogDescription className="text-xs">偏好会自动保存。</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5">
          <Section icon={Palette} label="外观">
            <Row title="主题" desc="浅色 / 深色 / 跟随系统">
              <ThemeToggle />
            </Row>
          </Section>

          <Section icon={SquareTerminal} label="终端">
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
          </Section>

          <Section icon={SlidersHorizontal} label="行为">
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
          </Section>

          <Section icon={Plug} label="端口工具">
            <div className="p-3">
              <PortTool />
            </div>
          </Section>

          <Section icon={Info} label="关于">
            <div className="space-y-1 px-3 py-3 font-mono text-[11px] text-muted-foreground">
              <div className="text-[12px] font-semibold text-foreground">DevDock 0.1.0</div>
              <div>
                Electron {versions.electron} · Node {versions.node} · Chromium {versions.chrome}
              </div>
            </div>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
