'use client'

import { ClipboardList, FileText, Package } from 'lucide-react'
import { formatarQtdEstoque, type SaldosKardex, type TipoEstoqueVisao } from '@/lib/estoque'
import { cn } from '@/lib/utils'

type Props = {
  saldos: SaldosKardex | null
  unidade?: string
  tipoAtivo?: TipoEstoqueVisao
  className?: string
}

function CardSaldo({
  titulo,
  icone: Icone,
  valor,
  unidade,
  destaque,
  detalhe,
}: {
  titulo: string
  icone: typeof Package
  valor: number | null
  unidade: string
  destaque?: boolean
  detalhe?: string
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-start gap-3 rounded-lg border bg-card p-4 shadow-xs',
        destaque && 'border-primary/50 ring-1 ring-primary/20',
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icone className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-primary tabular-nums">
          {valor == null ? '—' : formatarQtdEstoque(valor)}
          {valor != null && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {unidade}
            </span>
          )}
        </p>
        {detalhe && (
          <p className="mt-1 text-[11px] text-muted-foreground">{detalhe}</p>
        )}
      </div>
    </div>
  )
}

export function CardsSaldosEstoque({
  saldos,
  unidade = 'Unidades',
  tipoAtivo,
  className,
}: Props) {
  const detalheDisponivel =
    saldos == null
      ? undefined
      : `Reservado ${formatarQtdEstoque(saldos.qtdReservada)} · Bloqueado ${formatarQtdEstoque(saldos.qtdBloqueada)}`

  return (
    <div className={cn('grid gap-3 sm:grid-cols-3', className)}>
      <CardSaldo
        titulo="Estoque disponível"
        icone={Package}
        valor={saldos?.qtdDisponivel ?? null}
        unidade={unidade}
        destaque={tipoAtivo === 'disponivel'}
        detalhe={detalheDisponivel}
      />
      <CardSaldo
        titulo="Estoque físico"
        icone={ClipboardList}
        valor={saldos?.qtdFisica ?? null}
        unidade={unidade}
        destaque={tipoAtivo === 'fisico'}
      />
      <CardSaldo
        titulo="Estoque fiscal"
        icone={FileText}
        valor={saldos?.qtdFiscal ?? null}
        unidade={unidade}
        destaque={tipoAtivo === 'fiscal'}
        detalhe="Só muda com NF (ainda não automático)"
      />
    </div>
  )
}
