'use client'

import { BadgeStatus } from '@/components/ui/badge-status'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  rotuloStatusContaPagar,
  rotuloTipo,
  tituloVencido,
  varianteStatusContaPagar,
} from '@/lib/contas-a-pagar'

type PropsStatus = {
  status: string
  className?: string
}

export function BadgeStatusContaPagar({ status, className }: PropsStatus) {
  return (
    <BadgeStatus variante={varianteStatusContaPagar(status)} className={className}>
      {rotuloStatusContaPagar(status)}
    </BadgeStatus>
  )
}

type PropsTipo = {
  tipo: string
  className?: string
}

export function BadgeTipoContaPagar({ tipo, className }: PropsTipo) {
  const tributo = tipo === 'tributos'
  return (
    <Badge
      variant="secondary"
      className={cn(
        tributo
          ? 'bg-violet-500/15 text-violet-700 hover:bg-violet-500/15'
          : 'bg-slate-500/10 text-slate-700 hover:bg-slate-500/10',
        className
      )}
    >
      {rotuloTipo(tipo)}
    </Badge>
  )
}

type PropsVenc = {
  status: string
  vencimento: string | null | undefined
  dataFormatada: string
  dias?: number | null
}

export function CelulaVencimentoContaPagar({
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
