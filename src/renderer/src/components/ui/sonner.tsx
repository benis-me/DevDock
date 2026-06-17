import type { CSSProperties, JSX } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useAppStore } from '@/store/useAppStore'

// shadcn 的 sonner 用 next-themes 取主题；本项目没有 next-themes，
// 改为从应用 store 读取主题（其余与官方一致）。
function Toaster(props: ToasterProps): JSX.Element {
  const theme = useAppStore((s) => s.theme)
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)'
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
