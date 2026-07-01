import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  className?: string
}

export function CelulaBadge({ children, className }: Props) {
  return (
    <td className={cn('overflow-hidden px-2 py-2', className)}>
      <div className="min-w-0 max-w-full">{children}</div>
    </td>
  )
}
