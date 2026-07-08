'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EstadoOrdenacao } from '@/lib/ordenacao-lista'

type Props<T extends string> = {
  rotulo: string
  coluna: T
  ordenacao: EstadoOrdenacao<T>
  onOrdenar: (coluna: T) => void
  className?: string
  alinhamento?: 'left' | 'center' | 'right'
}

const alinhamentoClasse = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export function CabecalhoColunaOrdenavel<T extends string>({
  rotulo,
  coluna,
  ordenacao,
  onOrdenar,
  className,
  alinhamento = 'left',
}: Props<T>) {
  const ativo = ordenacao?.coluna === coluna
  return (
    <th className={cn('font-medium whitespace-nowrap', alinhamentoClasse[alinhamento], className)}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          alinhamento === 'center' && 'mx-auto',
          alinhamento === 'right' && 'ml-auto',
          ativo ? 'text-foreground' : 'text-muted-foreground'
        )}
        onClick={() => onOrdenar(coluna)}
      >
        {rotulo}
        {ativo && ordenacao.direcao === 'asc' ? (
          <ArrowUp className="size-3.5 shrink-0" />
        ) : ativo && ordenacao.direcao === 'desc' ? (
          <ArrowDown className="size-3.5 shrink-0" />
        ) : (
          <ArrowUpDown className="size-3.5 shrink-0 opacity-50" />
        )}
      </button>
    </th>
  )
}
