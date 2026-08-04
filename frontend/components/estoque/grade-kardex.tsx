'use client'

import Link from 'next/link'
import {
  formatarDataHoraKardex,
  formatarMoedaKardex,
  formatarQtdEstoque,
  type LinhaKardex,
} from '@/lib/estoque'
import { cn } from '@/lib/utils'

type Props = {
  linhas: LinhaKardex[]
  saldoInicial: number
  totais: { entrada: number; saida: number }
  saldoFinal: number
  unidade: string
}

function CelulaNumeroOrigem({ linha }: { linha: LinhaKardex }) {
  const curto = linha.origemId
    ? linha.origemId.slice(0, 8).toUpperCase()
    : linha.movimento
  if (linha.origem === 'nfe' && linha.origemId) {
    return (
      <Link
        href={`/entrada-notas/${linha.origemId}`}
        className="font-mono text-xs text-primary underline underline-offset-2"
        title="Abrir nota fiscal de entrada"
      >
        NF {curto}
      </Link>
    )
  }
  return (
    <span className="font-mono text-xs text-muted-foreground">{curto}</span>
  )
}

export function GradeKardex({
  linhas,
  saldoInicial,
  totais,
  saldoFinal,
  unidade,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <th className="whitespace-nowrap px-2.5 py-2.5">Data/hora</th>
            <th className="whitespace-nowrap px-2.5 py-2.5">Tipo</th>
            <th className="whitespace-nowrap px-2.5 py-2.5">Nº</th>
            <th className="min-w-[140px] px-2.5 py-2.5">Ocorrência</th>
            <th className="min-w-[140px] px-2.5 py-2.5">Parceiro</th>
            <th className="whitespace-nowrap px-2.5 py-2.5">Doc</th>
            <th className="min-w-[120px] px-2.5 py-2.5">Motivo / obs.</th>
            <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Entrada</th>
            <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Saída</th>
            <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Saldo</th>
            <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Preço/Custo</th>
            <th className="whitespace-nowrap px-2.5 py-2.5">Usuário</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b bg-muted/20 text-xs">
            <td colSpan={7} className="px-2.5 py-2 font-medium text-muted-foreground">
              Saldo inicial do período
            </td>
            <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">—</td>
            <td className="px-2.5 py-2 text-right tabular-nums text-muted-foreground">—</td>
            <td className="px-2.5 py-2 text-right font-semibold tabular-nums">
              {formatarQtdEstoque(saldoInicial)}
            </td>
            <td className="px-2.5 py-2 text-right text-muted-foreground">—</td>
            <td className="px-2.5 py-2" />
          </tr>
          {linhas.length === 0 ? (
            <tr>
              <td
                colSpan={12}
                className="px-2.5 py-8 text-center text-sm text-muted-foreground"
              >
                Nenhum movimento no período selecionado.
              </td>
            </tr>
          ) : (
            linhas.map((l) => (
              <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="whitespace-nowrap px-2.5 py-2 tabular-nums text-xs">
                  {formatarDataHoraKardex(l.data)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11px] font-medium',
                      l.qtdEntrada != null
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
                    )}
                  >
                    {l.tipo}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  <CelulaNumeroOrigem linha={l} />
                </td>
                <td className="px-2.5 py-2 text-xs">{l.ocorrencia}</td>
                <td className="px-2.5 py-2 text-xs">
                  <div className="font-medium">{l.parceiroNome || '—'}</div>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 font-mono text-xs">
                  {l.parceiroDocumento || '—'}
                </td>
                <td
                  className="max-w-[180px] truncate px-2.5 py-2 text-xs text-muted-foreground"
                  title={l.motivo || l.observacao || undefined}
                >
                  {l.motivo || l.observacao || '—'}
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap px-2.5 py-2 text-right tabular-nums',
                    l.qtdEntrada != null &&
                      'font-medium text-emerald-700 dark:text-emerald-400',
                  )}
                >
                  {l.qtdEntrada != null ? formatarQtdEstoque(l.qtdEntrada) : '—'}
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap px-2.5 py-2 text-right tabular-nums',
                    l.qtdSaida != null &&
                      'font-medium text-rose-700 dark:text-rose-400',
                  )}
                >
                  {l.qtdSaida != null ? formatarQtdEstoque(l.qtdSaida) : '—'}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-right font-semibold tabular-nums">
                  {formatarQtdEstoque(l.saldo)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums text-xs">
                  {formatarMoedaKardex(l.precoCusto)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-xs">
                  {l.usuarioNome || '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40 text-xs font-semibold">
            <td colSpan={7} className="px-2.5 py-2.5">
              Totais do período ({unidade})
            </td>
            <td className="px-2.5 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatarQtdEstoque(totais.entrada)}
            </td>
            <td className="px-2.5 py-2.5 text-right tabular-nums text-rose-700 dark:text-rose-400">
              {formatarQtdEstoque(totais.saida)}
            </td>
            <td className="px-2.5 py-2.5 text-right tabular-nums">
              {formatarQtdEstoque(saldoFinal)}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
