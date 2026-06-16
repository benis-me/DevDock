import type { JSX, ReactNode } from 'react'
import { useState } from 'react'
import { Settings as SettingsIcon, Minus, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Hint } from '@/components/ui/hint'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

const FONT_MIN = 9
const FONT_MAX = 20

function SectionTitle({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="mb-0.5 mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground first:mt-0">
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
    <div className="flex items-center justify-between gap-4 py-2.5">
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
    <div className="flex items-center gap-1">
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
  const killPort = useAppStore((s) => s.killPort)

  const [portInput, setPortInput] = useState('')
  const [busy, setBusy] = useState(false)
  const versions = window.devdock.versions

  async function freePort(): Promise<void> {
    const port = parseInt(portInput, 10)
    if (!port || port < 1 || port > 65535) return
    setBusy(true)
    const killed = await killPort(port)
    setBusy(false)
    const { toast } = await import('sonner')
    if (killed.length) {
      toast.success(`已释放端口 ${port}`, { description: `终止了 ${killed.length} 个进程` })
      setPortInput('')
    } else {
      toast(`端口 ${port} 未被占用`)
    }
  }

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

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>偏好会自动保存。</DialogDescription>
        </DialogHeader>

        <div className="-mt-1 divide-y divide-border/60">
          {/* 外观 */}
          <div className="pb-2">
            <SectionTitle>外观</SectionTitle>
            <Row title="主题" desc="浅色 / 深色 / 跟随系统">
              <ThemeToggle />
            </Row>
          </div>

          {/* 终端 */}
          <div className="py-2">
            <SectionTitle>终端</SectionTitle>
            <Row title="字号" desc={`${FONT_MIN}–${FONT_MAX} px，即时生效`}>
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
          </div>

          {/* 行为 */}
          <div className="py-2">
            <SectionTitle>行为</SectionTitle>
            <Row title="注入项目 .env" desc="启动脚本时合并 .env / .env.local 到环境变量">
              <Switch
                label="注入项目 .env"
                checked={settings.injectEnv}
                onCheckedChange={(v) => setSettings({ injectEnv: v })}
              />
            </Row>
            <Row
              title="默认用 portless 启动"
              desc={
                portlessAvailable
                  ? '长任务在未单独设置时，默认走 portless'
                  : '未检测到 portless，已禁用'
              }
            >
              <Switch
                label="默认用 portless 启动"
                disabled={!portlessAvailable}
                checked={settings.portlessDefault}
                onCheckedChange={(v) => setSettings({ portlessDefault: v })}
              />
            </Row>
            <Row title="退出前确认" desc="仍有脚本运行时，退出前二次确认">
              <Switch
                label="退出前确认"
                checked={settings.confirmOnQuit}
                onCheckedChange={(v) => setSettings({ confirmOnQuit: v })}
              />
            </Row>
          </div>

          {/* 端口工具 */}
          <div className="py-2">
            <SectionTitle>端口工具</SectionTitle>
            <Row title="释放端口" desc="终止占用某个端口的进程（lsof + kill）">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="如 5173"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && freePort()}
                  className="h-8 w-24 font-mono text-[13px]"
                />
                <button
                  onClick={freePort}
                  disabled={busy || !portInput}
                  className={cn(
                    'h-8 rounded-md px-3 text-[13px] font-medium transition-colors',
                    'bg-foreground text-background hover:bg-foreground/90',
                    'disabled:pointer-events-none disabled:opacity-40'
                  )}
                >
                  释放
                </button>
              </div>
            </Row>
          </div>

          {/* 关于 */}
          <div className="pt-2">
            <SectionTitle>关于</SectionTitle>
            <div className="space-y-1 py-1 font-mono text-[11px] text-muted-foreground">
              <div className="text-foreground">DevDock 0.1.0</div>
              <div>
                Electron {versions.electron} · Node {versions.node} · Chromium {versions.chrome}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
