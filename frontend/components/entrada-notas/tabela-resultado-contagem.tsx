'use client'

import { BadgeStatus } from '@/components/ui/badge-status'
import { GradeRolavel } from '@/components/ui/grade-rolavel'
import { formatarQtdContagem, textoDiferencaContagem } from '@/lib/texto-diferenca-contagem'

export type ItemResultadoContagem = {
  id: string
  produtoId: string
  sku: string | null
  nomeExibicao: string
  unidade: string | null
  unidadeNome?: string | null
  qtdEsperada: number
  qtdContada: number
  diferenca: number
  statusItem: string
}

export type ResultadoContagem = {
  sessaoId: string
  status: string
  iniciadoEm: string | null
  finalizadoEm: string | null
  baixadaEm: string | null
  observacao: string | null
  multiNota: boolean
  qtdNotasSessao: number
  totais: { itens: number; ok: number; divergente: number }
  itens: ItemResultadoContagem[]
}

type Props = {
  resultado: ResultadoContagem
}

export function TabelaResultadoContagem({ resultado }: Props) {
  return (
    <div className="space-y-3">
      {resultado.multiNota && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
          Esta sessão incluiu {resultado.qtdNotasSessao} notas — as quantidades abaixo são
          agregadas por produto na sessão.
        </p>
      )}
      <GradeRolavel>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Produto</th>
              <th className="px-3 py-2 font-medium">Esperada</th>
              <th className="px-3 py-2 font-medium">Contada</th>
              <th className="px-3 py-2 font-medium">Diferença</th>
              <th className="px-3 py-2 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {resultado.itens.map((item) => {
              const divergente = item.statusItem === 'divergente'
              return (
                <tr
                  key={item.id}
                  className={`border-b last:border-0 ${divergente ? 'bg-amber-500/10' : ''}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{item.nomeExibicao}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.sku || '—'}
                      {item.unidadeNome || item.unidade
                        ? ` · ${item.unidadeNome || item.unidade}`
                        : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatarQtdContagem(item.qtdEsperada)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatarQtdContagem(item.qtdContada)}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {textoDiferencaContagem(item.diferenca)}
                  </td>
                  <td className="px-3 py-2">
                    {divergente ? (
                      <BadgeStatus variante="pendente">Divergente</BadgeStatus>
                    ) : (
                      <BadgeStatus variante="sucesso">OK</BadgeStatus>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </GradeRolavel>
    </div>
  )
}
