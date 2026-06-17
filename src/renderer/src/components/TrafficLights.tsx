import type { JSX, ComponentType } from 'react'
import { useEffect, useState } from 'react'
import { X, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

// 自绘的紧凑红绿灯（原生按钮已在主进程隐藏）。比系统略小一圈，
// hover 出 ✕ – + 符号，窗口失焦时整体转灰——尽量贴近原生观感。
function Light({
  color,
  label,
  Icon,
  onClick,
  active
}: {
  color: string
  label: string
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>
  onClick: () => void
  active: boolean
}): JSX.Element {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="group/tl flex size-[11px] items-center justify-center rounded-full ring-inset ring-black/10 transition-colors"
      style={{ backgroundColor: active ? color : 'var(--color-idle)', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.14)' }}
    >
      <Icon
        className="size-[7px] text-black/55 opacity-0 transition-opacity group-hover/lights:opacity-100"
        strokeWidth={3}
      />
    </button>
  )
}

export function TrafficLights(): JSX.Element {
  const [active, setActive] = useState(true)
  useEffect(() => {
    const on = (): void => setActive(true)
    const off = (): void => setActive(false)
    window.addEventListener('focus', on)
    window.addEventListener('blur', off)
    return () => {
      window.removeEventListener('focus', on)
      window.removeEventListener('blur', off)
    }
  }, [])

  return (
    <div className="group/lights no-drag fixed left-[13px] top-[13px] z-50 flex items-center gap-2">
      <Light
        active={active}
        color="#ff5f57"
        label="关闭"
        Icon={X}
        onClick={() => window.devdock.win.close()}
      />
      <Light
        active={active}
        color="#febc2e"
        label="最小化"
        Icon={Minus}
        onClick={() => window.devdock.win.minimize()}
      />
      <Light
        active={active}
        color="#28c840"
        label="缩放"
        Icon={Plus}
        onClick={() => window.devdock.win.maximize()}
      />
    </div>
  )
}
