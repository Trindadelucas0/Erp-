'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, MoreVertical } from 'lucide-react'
import { BadgeStatus } from '@/components/ui/badge-status'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type PlanoFinanceiroNo = {
  id: string
  codigo: string
  nome: string
  tipo: string
  classificacao: string | null
  mostrarNaDre: boolean
  permiteLancamentoManual?: boolean
  exigeAnexoLancamento?: boolean
  permiteUsoConsumo?: boolean
  ativo: boolean
  parentId: string | null
  filhos?: PlanoFinanceiroNo[]
}

type LinhaPlana = PlanoFinanceiroNo & { nivel: number; temFilhos: boolean }

function achatarArvore(
  nos: PlanoFinanceiroNo[],
  expandidos: Set<string>,
  nivel = 0
): LinhaPlana[] {
  const linhas: LinhaPlana[] = []
  for (const no of nos) {
    const filhos = no.filhos ?? []
    const temFilhos = filhos.length > 0
    linhas.push({ ...no, nivel, temFilhos })
    if (temFilhos && expandidos.has(no.id)) {
      linhas.push(...achatarArvore(filhos, expandidos, nivel + 1))
    }
  }
  return linhas
}

type Props = {
  arvore: PlanoFinanceiroNo[]
  busca: string
  filtroSituacao: 'todos' | 'ativos' | 'inativos'
  podeEditar: boolean
  podeDesativar: boolean
  aoEditar: (plano: PlanoFinanceiroNo) => void
  aoAlternarAtivo: (plano: PlanoFinanceiroNo) => void
}

export function ArvorePlanosFinanceiros({
  arvore,
  busca,
  filtroSituacao,
  podeEditar,
  podeDesativar,
  aoEditar,
  aoAlternarAtivo,
}: Props) {
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set())
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const refMenu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuAberto) return

    function aoClicarFora(evento: MouseEvent) {
      if (refMenu.current && !refMenu.current.contains(evento.target as Node)) {
        setMenuAberto(null)
      }
    }

    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [menuAberto])

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const achatado = achatarArvore(arvore, expandidos)

    return achatado.filter((linha) => {
      const matchBusca =
        !termo ||
        linha.codigo.toLowerCase().includes(termo) ||
        linha.nome.toLowerCase().includes(termo)
      const matchSituacao =
        filtroSituacao === 'todos' ||
        (filtroSituacao === 'ativos' && linha.ativo) ||
        (filtroSituacao === 'inativos' && !linha.ativo)
      return matchBusca && matchSituacao
    })
  }, [arvore, expandidos, busca, filtroSituacao])

  function alternarExpansao(id: string) {
    setExpandidos((prev) => {
      const prox = new Set(prev)
      if (prox.has(id)) prox.delete(id)
      else prox.add(id)
      return prox
    })
  }

  if (linhas.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum plano financeiro encontrado.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-visible rounded-lg border border-border bg-card">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[52%]" />
          <col className="w-[18%]" />
          <col className="w-[22%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Mostrar no DRE</th>
            <th className="px-4 py-3 font-medium">Situação</th>
            <th className="px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
              <td className="max-w-0 px-4 py-3">
                <div
                  className="flex min-w-0 items-center gap-1"
                  style={{ paddingLeft: `${linha.nivel * 20}px` }}
                >
                  {linha.temFilhos ? (
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
                      onClick={() => alternarExpansao(linha.id)}
                    >
                      {expandidos.has(linha.id) ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                  ) : (
                    <span className="inline-block w-5 shrink-0" />
                  )}
                  <span
                    className={cn('truncate', linha.temFilhos && 'font-semibold')}
                    title={`${linha.codigo} - ${linha.nome}`}
                  >
                    {linha.codigo} - {linha.nome}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {linha.mostrarNaDre ? 'Sim' : ''}
              </td>
              <td className="px-4 py-3">
                <BadgeStatus variante={linha.ativo ? 'ativo' : 'reprovado'}>
                  {linha.ativo ? 'Habilitado' : 'Desabilitado'}
                </BadgeStatus>
              </td>
              <td className="relative overflow-visible px-2 py-3">
                {(podeEditar || podeDesativar) && (
                  <div ref={menuAberto === linha.id ? refMenu : undefined} className="relative inline-block">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setMenuAberto((atual) => (atual === linha.id ? null : linha.id))
                      }
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                    {menuAberto === linha.id && (
                      <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-md border border-border bg-card py-1 shadow-lg">
                        {podeEditar && (
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              setMenuAberto(null)
                              aoEditar(linha)
                            }}
                          >
                            Editar
                          </button>
                        )}
                        {podeDesativar && (
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              setMenuAberto(null)
                              aoAlternarAtivo(linha)
                            }}
                          >
                            {linha.ativo ? 'Desabilitar' : 'Habilitar'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
