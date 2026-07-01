'use client'

import type { ReactNode } from 'react'

type Props = {
  titulo: string
  children: ReactNode
}

export function SecaoFormularioErp({ titulo, children }: Props) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/15 p-4">
      <p className="text-sm font-semibold text-foreground">{titulo}</p>
      {children}
    </section>
  )
}
