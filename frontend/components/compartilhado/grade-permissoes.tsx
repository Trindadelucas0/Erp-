'use client'

import type React from 'react'
import { useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'
import { cn } from '@/lib/utils'

/**
 * Grade de permissões por módulo e ação (Ver, Criar, Editar, Excluir).
 */

export type Permissao = {
  id: string
  module: string
  action: string
  key: string
}

const ROTULOS_MODULOS: Record<string, string> = {
  cadastros: 'Cadastros',
  clientes: 'Clientes',
  estoque: 'Estoque',
  financeiro: 'Financeiro',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações',
}

const ROTULOS_ACOES: Record<string, string> = {
  view: 'Ver',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
}

const ORDEM_ACOES = ['view', 'create', 'edit', 'delete']

type Props = {
  listaDePermissoes: Permissao[]
  idsSelecionados: string[]
  aoAlterar: React.Dispatch<React.SetStateAction<string[]>>
  desabilitado?: boolean
}

export function GradePermissoes({
  listaDePermissoes,
  idsSelecionados,
  aoAlterar,
  desabilitado = false,
}: Props) {
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<'modulo'>()

  const modulosBase = useMemo(
    () => [...new Set(listaDePermissoes.map((p) => p.module))],
    [listaDePermissoes]
  )

  const modulosExibidos = useMemo(
    () =>
      ordenarLista(modulosBase, ordenacao, (modulo) =>
        ROTULOS_MODULOS[modulo] || modulo
      ),
    [modulosBase, ordenacao]
  )

  function alternarId(id: string) {
    if (desabilitado) return

    aoAlterar((listaAtual) =>
      listaAtual.includes(id)
        ? listaAtual.filter((item) => item !== id)
        : [...listaAtual, id]
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Módulo" coluna="modulo" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
            {ORDEM_ACOES.map((acao) => (
              <th
                key={acao}
                className="px-4 py-3 text-center font-medium"
              >
                {ROTULOS_ACOES[acao]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modulosExibidos.map((modulo) => (
            <tr
              key={modulo}
              className="border-b border-border last:border-0 hover:bg-muted/30"
            >
              <td className="px-4 py-3 font-medium">
                {ROTULOS_MODULOS[modulo] || modulo}
              </td>
              {ORDEM_ACOES.map((acao) => {
                const permissao = listaDePermissoes.find(
                  (p) => p.module === modulo && p.action === acao
                )

                if (!permissao) {
                  return (
                    <td key={acao} className="px-4 py-3 text-center text-muted-foreground">
                      -
                    </td>
                  )
                }

                return (
                  <td key={acao} className="px-4 py-3 text-center">
                    <Checkbox
                      checked={idsSelecionados.includes(permissao.id)}
                      disabled={desabilitado}
                      onCheckedChange={() => alternarId(permissao.id)}
                      className={cn(desabilitado && 'opacity-50')}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Monta texto resumo das permissões de um papel. */
export function montarResumoDasPermissoes(
  permissoes: { permission: Permissao }[]
): string {
  if (permissoes.length === 0) return 'Nenhuma permissão'

  const porModulo: Record<string, string[]> = {}

  for (const item of permissoes) {
    const modulo =
      ROTULOS_MODULOS[item.permission.module] || item.permission.module
    const acao =
      ROTULOS_ACOES[item.permission.action] || item.permission.action

    if (!porModulo[modulo]) porModulo[modulo] = []
    porModulo[modulo].push(acao)
  }

  return Object.entries(porModulo)
    .map(([modulo, acoes]) => `${modulo} (${acoes.join(', ')})`)
    .join('; ')
}
