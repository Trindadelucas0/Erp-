'use client'

import { cn } from '@/lib/utils'
import type { StatusDaAba } from '@/hooks/use-validacao-de-abas'

type Aba = {
  id: string
  rotulo: string
  contador?: number
  /** Status de validação da aba. Quando ausente, comportamento padrão sem indicador. */
  status?: StatusDaAba
}

type Props = {
  abas: Aba[]
  abaAtiva: string
  aoMudar: (id: string) => void
  className?: string
}

function IndicadorDeStatus({ status }: { status: StatusDaAba }) {
  if (status === 'valid') {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/15 text-green-600">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M3 3l4 4M7 3L3 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    )
  }

  return null
}

export function Abas({ abas, abaAtiva, aoMudar, className }: Props) {
  return (
    <div
      className={cn(
        'flex gap-1 border-b border-border',
        className
      )}
    >
      {abas.map((aba) => (
        <button
          key={aba.id}
          type="button"
          onClick={() => aoMudar(aba.id)}
          className={cn(
            'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            abaAtiva === aba.id
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {aba.rotulo}
          {aba.status && <IndicadorDeStatus status={aba.status} />}
          {aba.contador !== undefined && aba.contador > 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-xs font-medium',
                abaAtiva === aba.id
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {aba.contador}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
