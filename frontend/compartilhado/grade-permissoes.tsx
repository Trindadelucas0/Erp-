'use client'

import type React from 'react'

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
  estoque: 'Estoque',
  vendas: 'Vendas',
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
  const modulos = [
    ...new Set(listaDePermissoes.map((p) => p.module)),
  ].sort()

  function alternarId(id: string) {
    if (desabilitado) return

    aoAlterar((listaAtual) =>
      listaAtual.includes(id)
        ? listaAtual.filter((item) => item !== id)
        : [...listaAtual, id]
    )
  }

  return (
    <table border={1} cellPadding={6}>
      <thead>
        <tr>
          <th>Módulo</th>
          {ORDEM_ACOES.map((acao) => (
            <th key={acao}>{ROTULOS_ACOES[acao]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {modulos.map((modulo) => (
          <tr key={modulo}>
            <td>{ROTULOS_MODULOS[modulo] || modulo}</td>
            {ORDEM_ACOES.map((acao) => {
              const permissao = listaDePermissoes.find(
                (p) => p.module === modulo && p.action === acao
              )

              if (!permissao) {
                return <td key={acao}>-</td>
              }

              return (
                <td key={acao} style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={idsSelecionados.includes(permissao.id)}
                    disabled={desabilitado}
                    onChange={() => alternarId(permissao.id)}
                  />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
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
