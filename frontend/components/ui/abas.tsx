'use client'

import { cn } from '@/lib/utils'

type Aba = {
  id: string
  rotulo: string
  contador?: number
}

type Props = {
  abas: Aba[]
  abaAtiva: string
  aoMudar: (id: string) => void
  className?: string
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
