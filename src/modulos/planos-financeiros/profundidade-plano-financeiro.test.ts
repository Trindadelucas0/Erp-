import { describe, expect, it } from 'vitest'
import {
  codigoProfundidadeValido,
  planoInvalidoPorProfundidade,
  precisaSanitizarProfundidade,
  sanitizarProfundidadeEmMemoria,
  validarProfundidadeEstado,
} from './profundidade-plano-financeiro.js'

describe('profundidade-plano-financeiro', () => {
  it('codigoProfundidadeValido aceita até 3 segmentos', () => {
    expect(codigoProfundidadeValido('1.1')).toBe(true)
    expect(codigoProfundidadeValido('1.1.1')).toBe(true)
    expect(codigoProfundidadeValido('1.1.1.1')).toBe(false)
  })

  it('detecta plano com pai subgrupo', () => {
    const planos = [
      { id: 'g', codigo: '1.1', parentId: null },
      { id: 's', codigo: '1.1.1', parentId: 'g' },
      { id: 'x', codigo: '1.1.1.1', parentId: 's' },
    ]
    const mapa = new Map(planos.map((p) => [p.id, p]))
    expect(planoInvalidoPorProfundidade(planos[2], mapa)).toBe(true)
    expect(precisaSanitizarProfundidade(planos)).toBe(true)
  })

  it('sanitiza subgrupo do subgrupo para filho do grupo', () => {
    const planos = [
      { id: 'g', codigo: '3.1', parentId: null },
      { id: 's', codigo: '3.1.1', parentId: 'g' },
      { id: 'x', codigo: '3.1.1.1', parentId: 's' },
    ]

    const updates = sanitizarProfundidadeEmMemoria(planos, 'resultado')
    expect(updates.length).toBeGreaterThan(0)

    const patchX = updates.find((u) => u.id === 'x')
    expect(patchX?.parentId).toBe('g')
    expect(patchX?.codigo).toBe('3.1.2')
  })

  it('validarProfundidadeEstado rejeita estado com 3 níveis', () => {
    const estado = new Map([
      ['g', { id: 'g', codigo: '1.1', parentId: null }],
      ['s', { id: 's', codigo: '1.1.1', parentId: 'g' }],
      ['x', { id: 'x', codigo: '1.1.1.1', parentId: 's' }],
    ])
    expect(() => validarProfundidadeEstado(estado)).toThrow()
  })

  it('árvore com cap de 2 níveis não aninha filhos de subgrupo', () => {
    type No = { id: string; parentId: string | null; filhos: No[] }
    const planos = [
      { id: 'g', codigo: '1.1', parentId: null },
      { id: 's', codigo: '1.1.1', parentId: 'g' },
      { id: 'x', codigo: '1.1.1.1', parentId: 's' },
    ]
    const mapa = new Map<string, No>()
    const raizes: No[] = []
    const parentPorId = new Map(planos.map((p) => [p.id, p.parentId]))

    for (const plano of planos) {
      mapa.set(plano.id, { id: plano.id, parentId: plano.parentId, filhos: [] })
    }
    for (const plano of planos) {
      const no = mapa.get(plano.id)!
      if (plano.parentId && mapa.has(plano.parentId)) {
        const paiParentId = parentPorId.get(plano.parentId)
        if (paiParentId === null || paiParentId === undefined) {
          mapa.get(plano.parentId)!.filhos.push(no)
        } else {
          raizes.push(no)
        }
      } else {
        raizes.push(no)
      }
    }

    function profundidadeMaxima(nos: No[], nivel = 0): number {
      let max = nivel
      for (const no of nos) {
        if (no.filhos.length > 0) {
          max = Math.max(max, profundidadeMaxima(no.filhos, nivel + 1))
        }
      }
      return max
    }

    expect(profundidadeMaxima(raizes)).toBeLessThanOrEqual(1)
    expect(mapa.get('s')!.filhos).toHaveLength(0)
  })
})
