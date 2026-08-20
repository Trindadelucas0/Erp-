'use client'

import { BadgeStatus } from '@/components/ui/badge-status'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  rotuloStatusContaReceber,
  rotuloTipo,
  rotuloOrigemContaReceber,
  tituloVencido,
  varianteStatusContaReceber,
} from '@/lib/contas-a-receber'

type PropsStatus = {
  status: string
  className?: string
}

export function BadgeStatusContaReceber({ status, className }: PropsStatus) {
  return (
    <BadgeStatus variante={varianteStatusContaReceber(status)} className={className}>
      {rotuloStatusContaReceber(status)}
    </BadgeStatus>
  )
}

type PropsTipo = {
  tipo: string
  className?: string
}

export function BadgeTipoContaReceber({ tipo, className }: PropsTipo) {
  const credito = tipo === 'credito'
  return (
    <Badge
      variant="secondary"
      className={cn(
        credito
          ? 'bg-teal-500/15 text-teal-800 hover:bg-teal-500/15'
          : 'bg-slate-500/10 text-slate-700 hover:bg-slate-500/10',
        className
      )}
    >
      {rotuloTipo(tipo)}
    </Badge>
  )
}

type PropsOrigem = {
  origem: string
  className?: string
}

export function BadgeOrigemContaReceber({ origem, className }: PropsOrigem) {
  return (
    <Badge
      variant="outline"
      className={cn('border-border text-muted-foreground', className)}
    >
      {rotuloOrigemContaReceber(origem)}
    </Badge>
  )
}

type PropsVenc = {
  status: string
  vencimento: string | null | undefined
  dataFormatada: string
  dias?: number | null
}

export function CelulaVencimentoContaReceber({
  status,
  vencimento,
  dataFormatada,
  dias,
}: PropsVenc) {
  const vencido = tituloVencido(status, vencimento)
  return (
    <div className="min-w-0">
      <div className={cn('font-medium', vencido && 'text-destructive')}>{dataFormatada}</div>
      {dias != null && status !== 'pago' && status !== 'cancelado' && (
        <div
          className={cn(
            'text-xs',
            vencido
              ? 'font-medium text-destructive'
              : dias <= 3
                ? 'text-amber-700'
                : 'text-muted-foreground'
          )}
        >
          {vencido
            ? `${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'} em atraso`
            : dias === 0
              ? 'Vence hoje'
              : `${dias} dia${dias === 1 ? '' : 's'}`}
        </div>
      )}
    </div>
  )
}
