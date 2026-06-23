import * as React from 'react'

import { cn } from '@/lib/utils'

export const classesSelect = cn(
  'h-9 w-full min-w-0 rounded-md border border-input',
  'bg-background text-foreground',
  'dark:bg-input/30',
  'px-3 py-1 text-sm shadow-xs',
  'transition-[color,box-shadow] outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
  'dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40'
)

export const classesSelectCompacto = cn(
  classesSelect,
  'h-8 px-2 text-sm'
)

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
