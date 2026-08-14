import * as React from 'react'

import { classesCampo, classesCampoCompacto } from '@/components/ui/classes-campo'
import { cn } from '@/lib/utils'

export const classesSelect = classesCampo

export const classesSelectCompacto = classesCampoCompacto

export const classesOption = 'bg-background text-foreground'

function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(classesSelect, className)}
      {...props}
    >
      {children}
    </select>
  )
}

export { Select }
