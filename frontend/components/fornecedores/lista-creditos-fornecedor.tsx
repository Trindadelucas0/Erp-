'use client'

import { useMemo } from 'react'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'

export type MovimentoCreditoFornecedor = {
  id: string
  tipo: string
  valor: number
  saldoAnterior: number
  saldoDepois: number
  motivo: string | null
  pedidoCompraId: string | null
  pedidoNumero: number | null
  createdAt: string
}

export type CreditoFornecedorComMovimentos = {
  id: string
  valor: number
  saldo: number
  origem: string | null
  vencimento: string | null
  movimentos?: MovimentoCreditoFornecedor[]
}

const ROTULO_TIPO: Record<string, string> = {
  entrada: 'Entrada',
  reserva: 'Reserva PO',
  baixa: 'Baixa NF',
  estorno_reserva: 'Estorno',
}

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function TabelaMovimentosCredito({ movimentos }: { movimentos: MovimentoCreditoFornecedor[] }) {
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<
    'data' | 'tipo' | 'valor' | 'saldo' | 'motivo'
  >()

  const movimentosExibidos = useMemo(
    () =>
      ordenarLista(movimentos, ordenacao, (m, coluna) => {
        switch (coluna) {
          case 'data':
            return new Date(m.createdAt)
          case 'tipo':
            return ROTULO_TIPO[m.tipo] ?? m.tipo
          case 'valor':
            return m.valor
          case 'saldo':
            return m.saldoDepois
          case 'motivo':
            return m.motivo ?? ''
        }
      }),
    [movimentos, ordenacao]
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <CabecalhoColunaOrdenavel className="py-1.5 pr-2" rotulo="Data" coluna="data" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
            <CabecalhoColunaOrdenavel className="py-1.5 pr-2" rotulo="Tipo" coluna="tipo" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
            <CabecalhoColunaOrdenavel className="py-1.5 pr-2" rotulo="Valor" coluna="valor" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
            <CabecalhoColunaOrdenavel className="py-1.5 pr-2" rotulo="Saldo depois" coluna="saldo" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
            <CabecalhoColunaOrdenavel className="py-1.5" rotulo="Motivo" coluna="motivo" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
          </tr>
        </thead>
        <tbody>
          {movimentosExibidos.map((m) => (
            <tr key={m.id} className="border-b border-border/60 last:border-0">
              <td className="py-1.5 pr-2 whitespace-nowrap">{formatarData(m.createdAt)}</td>
              <td className="py-1.5 pr-2">{ROTULO_TIPO[m.tipo] ?? m.tipo}</td>
              <td className="py-1.5 pr-2 tabular-nums">{formatarMoeda(m.valor)}</td>
              <td className="py-1.5 pr-2 tabular-nums">{formatarMoeda(m.saldoDepois)}</td>
              <td className="py-1.5">
                {m.motivo ?? '—'}
                {m.pedidoNumero != null && (
                  <span className="ml-1 text-muted-foreground">(PO #{m.pedidoNumero})</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type Props = {
  creditos: CreditoFornecedorComMovimentos[]
  carregando?: boolean
}

export function ListaCreditosFornecedor({ creditos, carregando }: Props) {
  if (carregando) {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">Carregando créditos...</p>
      </div>
    )
  }

  if (!creditos.length) {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="mb-1 text-sm font-medium">Créditos do fornecedor</p>
        <p className="text-xs text-muted-foreground">Nenhum crédito registrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">Créditos do fornecedor</p>

      {creditos.map((credito) => (
        <div key={credito.id} className="space-y-2 rounded-md border border-border/80 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <div>
              <span className="font-medium">{credito.origem || 'Crédito sem origem'}</span>
              {credito.vencimento && (
                <span className="ml-2 text-xs text-muted-foreground">
                  Venc.: {formatarData(credito.vencimento)}
                </span>
              )}
            </div>
            <div className="text-right text-xs tabular-nums">
              <p>
                Inicial: <span className="font-medium">{formatarMoeda(credito.valor)}</span>
              </p>
              <p>
                Saldo atual:{' '}
                <span className="font-medium text-primary">{formatarMoeda(credito.saldo)}</span>
              </p>
            </div>
          </div>

          {credito.movimentos && credito.movimentos.length > 0 ? (
            <TabelaMovimentosCredito movimentos={credito.movimentos} />
          ) : (
            <p className="text-xs text-muted-foreground">Sem movimentações registradas.</p>
          )}
        </div>
      ))}
    </div>
  )
}
