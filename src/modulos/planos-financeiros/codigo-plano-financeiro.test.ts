import { describe, expect, it } from 'vitest'
import {
  codigoFilhoPorIndice,
  codigoRaizPorIndice,
  coletarDescendentes,
  ehDescendente,
  substituirPrefixoCodigo,
} from './codigo-plano-financeiro.js'
import {
  ErroMovimentoPlano,
  executarMovimentoEmMemoria,
} from './logica-mover-plano-financeiro.js'

describe('codigo-plano-financeiro', () => {
  it('codigoFilhoPorIndice gera código filho', () => {
    expect(codigoFilhoPorIndice('1.1', 2)).toBe('1.1.2')
  })

  it('codigoRaizPorIndice gera código raiz por tipo', () => {
    expect(codigoRaizPorIndice('receita', 3)).toBe('1.3')
    expect(codigoRaizPorIndice('despesa', 2)).toBe('2.2')
  })

  it('substituirPrefixoCodigo atualiza nó e prefixo de descendentes', () => {
    expect(substituirPrefixoCodigo('1.2.1', '1.2.1', '1.1.2')).toBe('1.1.2')
    expect(substituirPrefixoCodigo('1.2.1.3', '1.2.1', '1.1.2')).toBe('1.1.2.3')
  })

  it('coletarDescendentes retorna todos os filhos recursivos', () => {
    const planos = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
      { id: 'd', parentId: 'a' },
    ]
    expect(coletarDescendentes('a', planos).sort()).toEqual(['b', 'c', 'd'].sort())
    expect(coletarDescendentes('b', planos)).toEqual(['c'])
  })

  it('ehDescendente detecta ancestralidade', () => {
    const parentPorId = new Map([
      ['b', 'a'],
      ['c', 'b'],
      ['a', null],
    ])
    expect(ehDescendente('a', 'c', parentPorId)).toBe(true)
    expect(ehDescendente('b', 'c', parentPorId)).toBe(true)
    expect(ehDescendente('c', 'a', parentPorId)).toBe(false)
  })
})

describe('executarMovimentoEmMemoria', () => {
  const ids = {
    p11: 'id-1-1',
    p111: 'id-1-1-1',
    p12: 'id-1-2',
    p121: 'id-1-2-1',
  }

  const base = [
    { id: ids.p11, codigo: '1.1', parentId: null },
    { id: ids.p111, codigo: '1.1.1', parentId: ids.p11 },
    { id: ids.p12, codigo: '1.2', parentId: null },
    { id: ids.p121, codigo: '1.2.1', parentId: ids.p12 },
  ]

  it('move folha depois de irmão em outro pai (1.2.1 → depois de 1.1.1)', () => {
    const { estado } = executarMovimentoEmMemoria(
      base,
      'receita',
      ids.p121,
      ids.p111,
      'depois'
    )

    expect(estado.get(ids.p121)!.codigo).toBe('1.1.2')
    expect(estado.get(ids.p121)!.parentId).toBe(ids.p11)
  })

  it('move nó com filhos para dentro de outro pai', () => {
    const comFilho = [
      ...base,
      { id: 'id-1-2-2', codigo: '1.2.2', parentId: ids.p12 },
    ]

    const { estado } = executarMovimentoEmMemoria(
      comFilho,
      'receita',
      ids.p12,
      ids.p11,
      'dentro'
    )

    expect(estado.get(ids.p12)!.codigo).toBe('1.1.2')
    expect(estado.get(ids.p12)!.parentId).toBe(ids.p11)
    expect(estado.get(ids.p121)!.codigo).toBe('1.1.2.1')
    expect(estado.get('id-1-2-2')!.codigo).toBe('1.1.2.2')
  })

  it('bloqueia mover para descendente (ciclo)', () => {
    expect(() =>
      executarMovimentoEmMemoria(base, 'receita', ids.p11, ids.p111, 'dentro')
    ).toThrow(ErroMovimentoPlano)
  })

  it('bloqueia mover para si mesmo', () => {
    expect(() =>
      executarMovimentoEmMemoria(base, 'receita', ids.p11, ids.p11, 'depois')
    ).toThrow(ErroMovimentoPlano)
  })

  it('renumera irmãos em cascata ao inserir no meio', () => {
    const comIrmaos = [
      { id: ids.p11, codigo: '1.1', parentId: null },
      { id: ids.p111, codigo: '1.1.1', parentId: ids.p11 },
      { id: 'id-1-1-2', codigo: '1.1.2', parentId: ids.p11 },
      { id: ids.p12, codigo: '1.2', parentId: null },
      { id: ids.p121, codigo: '1.2.1', parentId: ids.p12 },
    ]

    const { estado } = executarMovimentoEmMemoria(
      comIrmaos,
      'receita',
      ids.p121,
      ids.p111,
      'depois'
    )

    expect(estado.get(ids.p121)!.codigo).toBe('1.1.2')
    expect(estado.get('id-1-1-2')!.codigo).toBe('1.1.3')
  })
})
