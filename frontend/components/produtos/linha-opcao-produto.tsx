'use client'

import type { ReactNode } from 'react'
import { TextoDestaqueBusca } from '@/components/ui/texto-destaque-busca'
import { cn } from '@/lib/utils'

const COLUNAS =
  'grid min-w-0 flex-1 grid-cols-[minmax(4.75rem,5.75rem)_minmax(0,1fr)] items-baseline gap-x-3'

type Props = {
  sku: string | null | undefined
  nome: string
  /** Destaque de busca; omitir se não houver termo. */
  termoBusca?: string
  /** Conteúdo extra à direita do nome (ex.: unidade). */
  complemento?: ReactNode
  className?: string
}

/** Linha de opção de produto: Código e Nome em colunas alinhadas. */
export function LinhaOpcaoProduto({
  sku,
  nome,
  termoBusca = '',
  complemento,
  className,
}: Props) {
  const codigo = sku?.trim() || ''
  return (
    <span className={cn(COLUNAS, className)}>
      <span className="truncate font-mono text-xs tabular-nums text-muted-foreground">
        {codigo ? (
          termoBusca ? (
            <TextoDestaqueBusca texto={codigo} termo={termoBusca} />
          ) : (
            codigo
          )
        ) : (
          '—'
        )}
      </span>
      <span className="min-w-0 truncate">
        {termoBusca ? (
          <TextoDestaqueBusca texto={nome} termo={termoBusca} />
        ) : (
          nome
        )}
        {complemento}
      </span>
    </span>
  )
}

/** Cabeçalho opcional alinhado às colunas Código | Nome. */
export function CabecalhoOpcaoProduto({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        COLUNAS,
        'border-b border-border px-3 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase',
        className
      )}
    >
      <span>Código</span>
      <span>Nome</span>
    </div>
  )
}
