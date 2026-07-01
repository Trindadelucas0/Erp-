'use client'

import { AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  completo: boolean
  pendencias?: string[]
  somenteIcone?: boolean
  className?: string
}

function montarTitle(completo: boolean, pendencias: string[]): string | undefined {
  if (completo) return 'Completo'
  if (pendencias.length === 0) return 'Incompleto'
  return `Incompleto\n\nPendências:\n${pendencias.map((p) => `• ${p}`).join('\n')}`
}

export function BadgeCadastro({
  completo,
  pendencias = [],
  somenteIcone = false,
  className,
}: Props) {
  const title = montarTitle(completo, pendencias)

  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full flex-row items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        completo
          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
        !completo && pendencias.length > 0 && 'cursor-help',
        className
      )}
    >
      {completo ? (
        <Check className="size-2.5 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="size-2.5 shrink-0" aria-hidden />
      )}
      {!somenteIcone && (
        <span className="truncate">{completo ? 'Completo' : 'Incompleto'}</span>
      )}
      {somenteIcone && <span className="sr-only">{completo ? 'Completo' : 'Incompleto'}</span>}
    </span>
  )
}
