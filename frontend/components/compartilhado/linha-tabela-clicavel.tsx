'use client'

import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  aoClicar: () => void
  ariaLabel: string
  desabilitada?: boolean
  className?: string
}

export function LinhaTabelaClicavel({
  children,
  aoClicar,
  ariaLabel,
  desabilitada = false,
  className,
}: Props) {
  function aoTeclar(evento: KeyboardEvent<HTMLTableRowElement>) {
    if (desabilitada) return
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault()
      aoClicar()
    }
  }

  return (
    <tr
      role="button"
      tabIndex={desabilitada ? -1 : 0}
      onClick={() => {
        if (!desabilitada) aoClicar()
      }}
      onKeyDown={aoTeclar}
      aria-label={ariaLabel}
      aria-disabled={desabilitada}
      className={cn(
        'border-b border-border last:border-0',
        desabilitada
          ? 'pointer-events-none opacity-60'
          : 'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className
      )}
    >
      {children}
    </tr>
  )
}
