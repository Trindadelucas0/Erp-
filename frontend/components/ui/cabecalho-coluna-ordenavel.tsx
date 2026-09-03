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
  /** Permite quebra de linha no rótulo (útil em colunas estreitas com texto longo). */
  quebrarTexto?: boolean
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
  quebrarTexto = false,
}: Props<T>) {
  const ativo = ordenacao?.coluna === coluna
  return (
    <th
      className={cn(
        'font-medium',
        quebrarTexto ? 'overflow-hidden whitespace-normal' : 'whitespace-nowrap',
        alinhamentoClasse[alinhamento],
        className
      )}
    >
      <button
        type="button"
        className={cn(
          'items-center gap-1 hover:text-foreground',
          quebrarTexto
            ? 'flex w-full min-w-0 whitespace-normal leading-tight'
            : 'inline-flex',
          alinhamento === 'center' && (quebrarTexto ? 'justify-center' : 'mx-auto'),
          alinhamento === 'right' && (quebrarTexto ? 'justify-end' : 'ml-auto'),
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
