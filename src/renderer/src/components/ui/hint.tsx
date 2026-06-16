import type { JSX, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function Hint({
  label,
  side = 'bottom',
  delay,
  children
}: {
  label: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  children: ReactNode
}): JSX.Element {
  return (
    <Tooltip delayDuration={delay}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
