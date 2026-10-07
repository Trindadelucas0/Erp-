'use client'

import type React from 'react'
import { useCallback } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

export type GrupoTelasCatalogo = {
  id: string
  rotulo: string
  telas: Array<{
    pageKey: string
    rotulo: string
    abas: Array<{ id: string; rotulo: string }>
  }>
}

export type SelecaoTelasPapel = Record<string, string[]>

type Props = {
  grupos: GrupoTelasCatalogo[]
  selecao: SelecaoTelasPapel
  aoAlterar: React.Dispatch<React.SetStateAction<SelecaoTelasPapel>>
  desabilitado?: boolean
}

function paginaMarcada(selecao: SelecaoTelasPapel, pageKey: string, qtdAbas: number) {
  if (qtdAbas === 0) return pageKey in selecao
  const abas = selecao[pageKey]
  return Boolean(abas && abas.length > 0)
}

export function ArvoreTelasPapel({
  grupos,
  selecao,
  aoAlterar,
  desabilitado = false,
}: Props) {
  const alternarPagina = useCallback(
    (pageKey: string, idsAbas: string[], marcado: boolean) => {
      if (desabilitado) return
      aoAlterar((prev) => {
        const next = { ...prev }
        if (!marcado) {
          delete next[pageKey]
          return next
        }
        if (idsAbas.length === 0) {
          next[pageKey] = []
        } else {
          next[pageKey] = [...idsAbas]
        }
        return next
      })
    },
    [aoAlterar, desabilitado]
  )

  const alternarAba = useCallback(
    (pageKey: string, tabId: string, marcado: boolean) => {
      if (desabilitado) return
      aoAlterar((prev) => {
        const atual = new Set(prev[pageKey] ?? [])
        if (marcado) atual.add(tabId)
        else atual.delete(tabId)
        const next = { ...prev }
        if (atual.size === 0) delete next[pageKey]
        else next[pageKey] = [...atual]
        return next
      })
    },
    [aoAlterar, desabilitado]
  )

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      {grupos.map((grupo) => (
        <div key={grupo.id} className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{grupo.rotulo}</p>
          <div className="space-y-3 pl-2">
            {grupo.telas.map((tela) => {
              const idsAbas = tela.abas.map((a) => a.id)
              const marcada = paginaMarcada(selecao, tela.pageKey, tela.abas.length)
              return (
                <div key={tela.pageKey} className="space-y-1.5">
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-2 text-sm font-medium',
                      desabilitado && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <Checkbox
                      checked={marcada}
                      disabled={desabilitado}
                      onCheckedChange={(v) =>
                        alternarPagina(tela.pageKey, idsAbas, v === true)
                      }
                    />
                    {tela.rotulo}
                  </label>
                  {tela.abas.length > 0 && marcada && (
                    <div className="ml-6 grid gap-1.5 sm:grid-cols-2">
                      {tela.abas.map((aba) => (
                        <label
                          key={aba.id}
                          className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Checkbox
                            checked={selecao[tela.pageKey]?.includes(aba.id) ?? false}
                            disabled={desabilitado}
                            onCheckedChange={(v) =>
                              alternarAba(tela.pageKey, aba.id, v === true)
                            }
                          />
                          {aba.rotulo}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Converte resposta do papel (paginas + abas) em SelecaoTelasPapel. */
export function selecaoFromPapel(papel: {
  paginas?: { pageKey: string }[]
  abas?: { pageKey: string; tabKey: string }[]
}): SelecaoTelasPapel {
  const sel: SelecaoTelasPapel = {}
  for (const p of papel.paginas ?? []) {
    sel[p.pageKey] = []
  }
  for (const a of papel.abas ?? []) {
    if (!sel[a.pageKey]) sel[a.pageKey] = []
    sel[a.pageKey].push(a.tabKey)
  }
  return sel
}

export function selecaoParaPayload(selecao: SelecaoTelasPapel) {
  return Object.entries(selecao).map(([pageKey, abas]) => ({ pageKey, abas }))
}
