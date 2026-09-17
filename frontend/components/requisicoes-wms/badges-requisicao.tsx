'use client'

import { cn } from '@/lib/utils'
import { ROTULO_PRIORIDADE, ROTULO_STATUS, type StatusRequisicao } from '@/lib/requisicoes-wms'

const CLASSE_STATUS: Record<StatusRequisicao, string> = {
  pendente: 'bg-muted text-muted-foreground',
  disponivel: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100',
  atribuida: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100',
  em_execucao: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  pausada: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100',
  concluida: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  cancelada: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  bloqueada: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
}

const CLASSE_PRIORIDADE: Record<number, string> = {
  1: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
  2: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100',
  3: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  4: 'bg-muted text-muted-foreground',
}

export function BadgeStatusRequisicao({ status }: { status: string }) {
  const chave = status as StatusRequisicao
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
        CLASSE_STATUS[chave] ?? 'bg-muted'
      )}
    >
      {ROTULO_STATUS[chave] ?? status}
    </span>
  )
}

export function BadgePrioridadeRequisicao({ prioridade }: { prioridade: number }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
        CLASSE_PRIORIDADE[prioridade] ?? 'bg-muted'
      )}
    >
      {ROTULO_PRIORIDADE[prioridade] ?? prioridade}
    </span>
  )
}
