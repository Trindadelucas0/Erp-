'use client'

import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { BadgeStatus } from '@/components/ui/badge-status'
import { cn } from '@/lib/utils'

export type ResultadoEtapaUi = {
  status: string
  avisos?: string[]
  bloqueios?: string[]
  bloqueiosNaoLiberaveis?: string[]
  detalhes?: Record<string, unknown>
}

export function varianteStatusEtapa(
  status: string
): 'reprovado' | 'pendente' | 'sucesso' | 'info' {
  if (status === 'bloqueante') return 'reprovado'
  if (status === 'aviso' || status === 'pendente') return 'pendente'
  if (status === 'ok') return 'sucesso'
  return 'info'
}

export function rotuloStatusEtapa(status: string): string {
  const mapa: Record<string, string> = {
    bloqueante: 'Bloqueante',
    aviso: 'Com avisos',
    ok: 'Ok',
    pendente: 'Pendente',
  }
  return mapa[status] ?? status
}

export function StatusIconEtapa({ status }: { status: string }) {
  if (status === 'ok') {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
  }
  if (status === 'bloqueante') {
    return <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />
  }
  return <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />
}

type Props = {
  etapa?: ResultadoEtapaUi | null
  /** Texto curto sob o badge (orientação). */
  dica?: string | null
}

/**
 * Resumo genérico de etapa (Fiscal, Frete, fallback).
 * Evita muro de texto: badge + cards curtos.
 */
export function EtapaResumo({ etapa, dica }: Props) {
  if (!etapa) return <p className="text-sm text-muted-foreground">Pendente</p>

  const bloqueios = [
    ...(etapa.bloqueiosNaoLiberaveis ?? []),
    ...(etapa.bloqueios ?? []),
  ].filter((b): b is string => typeof b === 'string' && b.length > 0)
  const avisos = (etapa.avisos ?? []).filter(
    (a): a is string => typeof a === 'string' && a.length > 0
  )
  const temProblema = bloqueios.length > 0 || avisos.length > 0

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusIconEtapa status={etapa.status} />
        <BadgeStatus variante={varianteStatusEtapa(etapa.status)}>
          {rotuloStatusEtapa(etapa.status)}
        </BadgeStatus>
        {(bloqueios.length > 0 || avisos.length > 0) && (
          <span className="text-xs text-muted-foreground">
            {bloqueios.length > 0 && (
              <span className="text-destructive">
                {bloqueios.length} bloqueio{bloqueios.length === 1 ? '' : 's'}
              </span>
            )}
            {bloqueios.length > 0 && avisos.length > 0 && ' · '}
            {avisos.length > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                {avisos.length} aviso{avisos.length === 1 ? '' : 's'}
              </span>
            )}
          </span>
        )}
      </div>

      {dica && etapa.status === 'bloqueante' && (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {dica}
        </p>
      )}

      {etapa.status === 'ok' && !temProblema && (
        <p className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
          Etapa sem pendências.
        </p>
      )}

      {bloqueios.length > 0 && (
        <ul className="space-y-1.5">
          {bloqueios.map((b) => (
            <li
              key={b}
              className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm leading-snug text-foreground"
            >
              {b}
            </li>
          ))}
        </ul>
      )}

      {avisos.length > 0 && (
        <ul className="space-y-1.5">
          {avisos.map((a) => (
            <li
              key={a}
              className={cn(
                'rounded-md border px-3 py-2 text-sm leading-snug',
                'border-amber-500/25 bg-amber-500/5 text-amber-900 dark:text-amber-200'
              )}
            >
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
