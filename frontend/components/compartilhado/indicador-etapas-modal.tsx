'use client'

import { cn } from '@/lib/utils'

type Etapa = {
  id: string
  rotulo: string
}

type Props = {
  etapas: Etapa[]
  etapaAtiva: string
  className?: string
}

export function IndicadorEtapasModal({ etapas, etapaAtiva, className }: Props) {
  const indiceAtivo = etapas.findIndex((e) => e.id === etapaAtiva)
  const etapaAtual = indiceAtivo >= 0 ? etapas[indiceAtivo] : etapas[0]
  const numero = indiceAtivo >= 0 ? indiceAtivo + 1 : 1

  return (
    <div className={cn('space-y-2 border-b border-border pb-3', className)}>
      <p className="text-sm text-muted-foreground">
        Etapa {numero} de {etapas.length} —{' '}
        <span className="font-medium text-foreground">{etapaAtual?.rotulo}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {etapas.map((etapa, i) => {
          const ativa = etapa.id === etapaAtiva
          const concluida = i < indiceAtivo
          return (
            <span
              key={etapa.id}
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
                ativa && 'bg-primary/15 text-primary',
                concluida && !ativa && 'bg-green-500/10 text-green-700 dark:text-green-400',
                !ativa && !concluida && 'bg-muted text-muted-foreground'
              )}
            >
              {i + 1}. {etapa.rotulo}
            </span>
          )
        })}
      </div>
    </div>
  )
}
