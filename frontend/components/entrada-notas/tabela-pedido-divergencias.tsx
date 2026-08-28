'use client'

import { BadgeStatus } from '@/components/ui/badge-status'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Label } from '@/components/ui/label'

export type LinhaResumoPedido = {
  pedidoNumero: string
  item: string
  esperado: number
  nota: number
  divergencia: string
  situacao: 'ok' | 'divergente' | 'aviso'
}

export type ResumoPedidoCompra = {
  vinculado: boolean
  semPedidoInformado: boolean
  pedido?: { id: string; numero: number }
  linhas: LinhaResumoPedido[]
}

type PedidoDisponivel = {
  id: string
  numero: number
  status: string
  fornecedorNome?: string | null
}

type Props = {
  resumo: ResumoPedidoCompra | null | undefined
  pedidosDisponiveis?: PedidoDisponivel[]
  pedidoCompraId?: string | null
  desabilitado?: boolean
  acao?: boolean
  onSelecionarPedido?: (pedidoId: string) => void
}

function formatarMoeda(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function TabelaPedidoDivergencias({
  resumo,
  pedidosDisponiveis = [],
  pedidoCompraId,
  desabilitado,
  acao,
  onSelecionarPedido,
}: Props) {
  const semPedido = !resumo?.vinculado || resumo.semPedidoInformado

  return (
    <CardPadrao titulo="Pedido de compra / divergências">
      <p className="mb-3 rounded-md border border-blue-200/80 bg-blue-50/80 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
        Nota de serviço — a ausência de pedido de compra <strong>não exige contagem física</strong>{' '}
        e não impede a consolidação documental.
      </p>

      {!desabilitado && onSelecionarPedido && pedidosDisponiveis.length > 0 && (
        <div className="mb-4">
          <Label htmlFor="pedido-nfse">Pedido de compra (opcional)</Label>
          <select
            id="pedido-nfse"
            className="mt-1 block w-full max-w-md rounded-md border bg-background px-3 py-2 text-sm"
            value={pedidoCompraId ?? ''}
            disabled={acao}
            onChange={(e) => {
              if (e.target.value) onSelecionarPedido(e.target.value)
            }}
          >
            <option value="">Não vinculado</option>
            {pedidosDisponiveis.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.numero} ({p.status})
                {p.fornecedorNome ? ` — ${p.fornecedorNome}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {semPedido ? (
        <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm font-medium">Pedido de compra: Não informado / Não vinculado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta nota não possui pedido de compra associado.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Pedido de compra</th>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Esperado</th>
                <th className="px-3 py-2 font-medium">Nota</th>
                <th className="px-3 py-2 font-medium">Divergência</th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {(resumo?.linhas ?? []).map((linha, i) => (
                <tr
                  key={`${linha.pedidoNumero}-${linha.item}-${i}`}
                  className={`border-b last:border-0 ${
                    linha.situacao === 'divergente' ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-medium">{linha.pedidoNumero}</td>
                  <td className="px-3 py-2">{linha.item}</td>
                  <td className="px-3 py-2 tabular-nums">{formatarMoeda(linha.esperado)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatarMoeda(linha.nota)}</td>
                  <td className="px-3 py-2 tabular-nums">{linha.divergencia}</td>
                  <td className="px-3 py-2">
                    {linha.situacao === 'ok' ? (
                      <BadgeStatus variante="sucesso">OK</BadgeStatus>
                    ) : (
                      <BadgeStatus variante="pendente">Divergente</BadgeStatus>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardPadrao>
  )
}
