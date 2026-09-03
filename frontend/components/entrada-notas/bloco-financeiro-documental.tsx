'use client'

import Link from 'next/link'
import { BadgeStatus } from '@/components/ui/badge-status'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Label } from '@/components/ui/label'
import { ComboboxPlanoFinanceiro } from '@/components/contas-a-pagar/combobox-plano-financeiro'
import type { PlanoFinanceiroOpcao } from '@/lib/contas-a-pagar'

export type ParcelaFinanceiroUi = {
  numeroDocumento: string
  vencimento: string
  valor: string
}

export type PreviaFinanceira = {
  parcelas: Array<{
    numero: number
    numeroDocumento: string | null
    vencimento: string | null
    valor: number
    planoFinanceiro: { id: string; codigo: string; nome: string } | null
    tipo: string
    status: 'a_gerar' | 'gerado'
  }>
  total: number
  origemPlano: 'nota' | 'fornecedor' | 'recorrencia' | 'cfop' | null
  planoFinanceiroId: string | null
  planoFinanceiro: { id: string; codigo: string; nome: string } | null
  completo: boolean
  bloqueios: string[]
}

type Props = {
  notaId: string
  previa: PreviaFinanceira | null | undefined
  planos: PlanoFinanceiroOpcao[]
  planoId: string
  parcelas: ParcelaFinanceiroUi[]
  titulosGerados?: boolean
  somenteLeitura?: boolean
  acao?: boolean
  variante?: 'servico' | 'uso_consumo'
  onPlanoChange: (id: string) => void
  onParcelaChange: (index: number, campo: 'vencimento' | 'valor', valor: string) => void
  onSalvar: () => void
}

function formatarRotuloPlano(plano: {
  codigo?: string | null
  nome?: string | null
  descricao?: string | null
} | null): string {
  if (!plano) return '—'
  const nome = plano.nome || plano.descricao || ''
  return `${plano.codigo ?? ''} ${nome}`.trim() || '—'
}

function formatarMoeda(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function rotuloOrigemPlano(origem: PreviaFinanceira['origemPlano']): string {
  if (origem === 'nota') return 'Plano escolhido na análise da nota.'
  if (origem === 'fornecedor') return 'Plano financeiro definido pelo cadastro do fornecedor.'
  if (origem === 'recorrencia') return 'Plano sugerido pela recorrência financeira casada.'
  if (origem === 'cfop') return 'Plano sugerido pelo CFOP de entrada.'
  return 'Selecione manualmente o plano financeiro.'
}

export function BlocoFinanceiroDocumental({
  notaId,
  previa,
  planos,
  planoId,
  parcelas,
  titulosGerados,
  somenteLeitura,
  acao,
  variante = 'servico',
  onPlanoChange,
  onParcelaChange,
  onSalvar,
}: Props) {
  const exibirTabelaGerada = titulosGerados && (previa?.parcelas.some((p) => p.status === 'gerado') ?? false)

  return (
    <CardPadrao titulo="Financeiro / títulos a gerar">
      <p className="mb-3 text-xs text-muted-foreground">
        {rotuloOrigemPlano(previa?.origemPlano ?? null)}{' '}
        {variante === 'uso_consumo'
          ? 'Uso e consumo / despesa: Contas a pagar é gerado ao consolidar.'
          : 'Contas a pagar é gerado ao consolidar.'}
      </p>

      {previa && previa.bloqueios.length > 0 && !somenteLeitura && (
        <ul className="mb-3 list-disc space-y-1 pl-4 text-sm text-amber-800 dark:text-amber-300">
          {previa.bloqueios.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      <p className="mb-3 text-sm">
        <span className="text-muted-foreground">Total da nota: </span>
        <strong className="tabular-nums">{formatarMoeda(previa?.total ?? null)}</strong>
      </p>

      {exibirTabelaGerada ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Parcela</th>
                <th className="px-3 py-2 font-medium">Vencimento</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Plano financeiro</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {previa!.parcelas.map((p) => (
                <tr key={p.numero} className="border-b last:border-0">
                  <td className="px-3 py-2 tabular-nums">{p.numero}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {p.vencimento
                      ? new Date(p.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatarMoeda(p.valor)}</td>
                  <td className="px-3 py-2">
                    {p.planoFinanceiro
                      ? formatarRotuloPlano(p.planoFinanceiro)
                      : '—'}
                  </td>
                  <td className="px-3 py-2">{p.tipo}</td>
                  <td className="px-3 py-2">
                    <BadgeStatus variante="sucesso">Gerado</BadgeStatus>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm">
            <Link
              href={`/contas-a-pagar?nfeRecebidaId=${encodeURIComponent(notaId)}`}
              className="text-primary underline"
            >
              Ver títulos a pagar
            </Link>
          </p>
        </div>
      ) : (
        <>
          {!somenteLeitura && (
            <div className="mb-4">
              <ComboboxPlanoFinanceiro
                rotulo="Plano financeiro"
                planos={planos}
                valor={planoId}
                aoMudar={onPlanoChange}
                obrigatorio
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Parcela</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Plano financeiro</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((p, index) => {
                  const plano =
                    previa?.planoFinanceiro ??
                    planos.find((pl) => pl.id === planoId) ??
                    null
                  return (
                    <tr key={index} className="border-b last:border-0">
                      <td className="px-3 py-2 tabular-nums">{index + 1}</td>
                      <td className="px-3 py-2">
                        {somenteLeitura ? (
                          <span className="tabular-nums">
                            {p.vencimento
                              ? new Date(p.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')
                              : '—'}
                          </span>
                        ) : (
                          <input
                            type="date"
                            className="block w-full min-w-[140px] rounded-md border bg-background px-2 py-1.5 text-sm"
                            value={p.vencimento}
                            disabled={acao}
                            onChange={(e) => onParcelaChange(index, 'vencimento', e.target.value)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {somenteLeitura ? (
                          <span className="tabular-nums">{formatarMoeda(Number(p.valor))}</span>
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="block w-full min-w-[100px] rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums"
                            value={p.valor}
                            disabled={acao}
                            onChange={(e) => onParcelaChange(index, 'valor', e.target.value)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {formatarRotuloPlano(plano)}
                      </td>
                      <td className="px-3 py-2">Duplicata</td>
                      <td className="px-3 py-2">
                        <BadgeStatus variante="pendente">A gerar</BadgeStatus>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!somenteLeitura && (
            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={acao || !planoId}
                onClick={onSalvar}
              >
                Salvar prévia financeira
              </Button>
            </div>
          )}
        </>
      )}
    </CardPadrao>
  )
}
