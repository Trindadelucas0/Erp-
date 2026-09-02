import type { TipoPlanoFinanceiro } from './codigo-plano-financeiro.js'
import { compararCodigoPlano } from './codigo-plano-financeiro.js'
import {
  renumerarListaFilhos,
  type EstadoPlanoMover,
} from './logica-mover-plano-financeiro.js'

export const SEGMENTOS_CODIGO_MAXIMO = 3

export function segmentosCodigo(codigo: string): number {
  return codigo.split('.').length
}

export function codigoProfundidadeValido(codigo: string): boolean {
  return segmentosCodigo(codigo) <= SEGMENTOS_CODIGO_MAXIMO
}

export function paiEhGrupo(
  parentId: string | null,
  mapa: Map<string, EstadoPlanoMover>
): boolean {
  if (!parentId) return false
  const pai = mapa.get(parentId)
  return Boolean(pai && pai.parentId === null)
}

export function planoInvalidoPorProfundidade(
  plano: EstadoPlanoMover,
  mapa: Map<string, EstadoPlanoMover>
): boolean {
  if (!plano.parentId) return false
  return !paiEhGrupo(plano.parentId, mapa)
}

export function precisaSanitizarProfundidade(planos: EstadoPlanoMover[]): boolean {
  const mapa = new Map(planos.map((p) => [p.id, p]))
  for (const plano of planos) {
    if (planoInvalidoPorProfundidade(plano, mapa)) return true
    if (!codigoProfundidadeValido(plano.codigo)) return true
  }
  return false
}

function filhosOrdenadosPorCodigo(
  parentId: string | null,
  estado: Map<string, EstadoPlanoMover>
): string[] {
  const filhos: EstadoPlanoMover[] = []
  for (const plano of estado.values()) {
    if (plano.parentId === parentId) filhos.push(plano)
  }
  return filhos
    .sort((a, b) => compararCodigoPlano(a.codigo, b.codigo))
    .map((p) => p.id)
}

function renumerarArvoreCompleta(
  estado: Map<string, EstadoPlanoMover>,
  tipo: TipoPlanoFinanceiro
) {
  const raizes = filhosOrdenadosPorCodigo(null, estado)
  renumerarListaFilhos(null, raizes, estado, tipo)
  for (const raizId of raizes) {
    const filhos = filhosOrdenadosPorCodigo(raizId, estado)
    renumerarListaFilhos(raizId, filhos, estado, tipo)
  }
}

function corrigirParentIdsInvalidos(estado: Map<string, EstadoPlanoMover>): boolean {
  let houveMudanca = false
  let alterado = true

  while (alterado) {
    alterado = false
    for (const plano of estado.values()) {
      if (!plano.parentId) continue

      const pai = estado.get(plano.parentId)
      if (!pai || pai.parentId !== null) {
        const novoParentId = pai?.parentId ?? null
        if (plano.parentId !== novoParentId) {
          plano.parentId = novoParentId
          alterado = true
          houveMudanca = true
        }
      }
    }
  }

  return houveMudanca
}

export function validarProfundidadeEstado(estado: Map<string, EstadoPlanoMover>): void {
  for (const plano of estado.values()) {
    if (!codigoProfundidadeValido(plano.codigo)) {
      throw new Error('Código excede a profundidade máxima permitida (grupo + subgrupo)')
    }
    if (!plano.parentId) continue
    if (!paiEhGrupo(plano.parentId, estado)) {
      throw new Error('Subgrupo não pode ter filhos; só grupos de 1º nível podem ter subgrupos')
    }
  }
}

export function sanitizarProfundidadeEmMemoria(
  planos: EstadoPlanoMover[],
  tipo: TipoPlanoFinanceiro
): { id: string; codigo: string; parentId?: string | null }[] {
  if (!precisaSanitizarProfundidade(planos)) return []

  const original = new Map(
    planos.map((p) => [p.id, { codigo: p.codigo, parentId: p.parentId }] as const)
  )

  const estado = new Map<string, EstadoPlanoMover>()
  for (const reg of planos) {
    estado.set(reg.id, { ...reg })
  }

  corrigirParentIdsInvalidos(estado)
  renumerarArvoreCompleta(estado, tipo)

  const updates: { id: string; codigo: string; parentId?: string | null }[] = []
  for (const [id, atual] of estado) {
    const orig = original.get(id)!
    if (atual.codigo !== orig.codigo || atual.parentId !== orig.parentId) {
      updates.push({
        id,
        codigo: atual.codigo,
        ...(atual.parentId !== orig.parentId ? { parentId: atual.parentId } : {}),
      })
    }
  }

  return updates
}
