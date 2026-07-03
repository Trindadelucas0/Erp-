import { describe, expect, it } from 'vitest'
import {
  codigoFilhoPorIndice,
  codigoRaizPorIndice,
  coletarDescendentes,
  ehDescendente,
  extrairSegmentosSugeridos,
  extrairSufixoDeCodigo,
  montarCodigoComSufixo,
  montarCodigoPorSegmentos,
  prefixoParaNovoPlano,
  segmentoGrupoDeCodigoPai,
  substituirPrefixoCodigo,
  sufixoCodigoValido,
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
    expect(codigoRaizPorIndice('resultado', 1)).toBe('3.1')
  })

  it('prefixoParaNovoPlano retorna prefixo por tipo ou pai', () => {
    expect(prefixoParaNovoPlano('receita')).toBe('1.')
    expect(prefixoParaNovoPlano('despesa')).toBe('2.')
    expect(prefixoParaNovoPlano('resultado')).toBe('3.')
    expect(prefixoParaNovoPlano('receita', '1.5')).toBe('1.5.')
  })

  it('montarCodigoComSufixo monta código completo', () => {
    expect(montarCodigoComSufixo('1.', 7)).toBe('1.7')
    expect(montarCodigoComSufixo('1.5.', 3)).toBe('1.5.3')
    expect(montarCodigoComSufixo('2.', 4)).toBe('2.4')
  })

  it('montarCodigoPorSegmentos monta código por segmentos editáveis', () => {
    expect(montarCodigoPorSegmentos('receita', 7)).toBe('1.7')
    expect(montarCodigoPorSegmentos('despesa', 4)).toBe('2.4')
    expect(montarCodigoPorSegmentos('receita', 5, 3)).toBe('1.5.3')
    expect(montarCodigoPorSegmentos('resultado', 1, null)).toBe('3.1')
  })

  it('extrairSegmentosSugeridos retorna segmentos para pré-preencher modal', () => {
    expect(extrairSegmentosSugeridos('1.7', 'receita', false)).toEqual({
      segmentoGrupo: 7,
      segmentoSubgrupo: null,
    })
    expect(extrairSegmentosSugeridos('1.5.3', 'receita', true)).toEqual({
      segmentoGrupo: 5,
      segmentoSubgrupo: 3,
    })
  })

  it('segmentoGrupoDeCodigoPai retorna último segmento do código pai', () => {
    expect(segmentoGrupoDeCodigoPai('1.5')).toBe(5)
    expect(segmentoGrupoDeCodigoPai('2.12')).toBe(12)
  })

  it('extrairSufixoDeCodigo retorna último segmento', () => {
    expect(extrairSufixoDeCodigo('1.3')).toBe(3)
    expect(extrairSufixoDeCodigo('1.5.2')).toBe(2)
    expect(extrairSufixoDeCodigo('1.5.2', '1.5.')).toBe(2)
    expect(extrairSufixoDeCodigo('1.3', '1.')).toBe(3)
  })

  it('sufixoCodigoValido aceita 0 a 99', () => {
    expect(sufixoCodigoValido(0)).toBe(true)
    expect(sufixoCodigoValido(1)).toBe(true)
    expect(sufixoCodigoValido(99)).toBe(true)
    expect(sufixoCodigoValido(-1)).toBe(false)
    expect(sufixoCodigoValido(100)).toBe(false)
    expect(sufixoCodigoValido(1.5)).toBe(false)
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

  it('bloqueia grupo dentro de outro grupo', () => {
    expect(() =>
      executarMovimentoEmMemoria(base, 'receita', ids.p12, ids.p11, 'dentro')
    ).toThrow(ErroMovimentoPlano)
  })

  it('bloqueia grupo em relação a subgrupo', () => {
    expect(() =>
      executarMovimentoEmMemoria(base, 'receita', ids.p12, ids.p111, 'antes')
    ).toThrow(ErroMovimentoPlano)
  })

  it('bloqueia subgrupo no nível de grupo', () => {
    expect(() =>
      executarMovimentoEmMemoria(base, 'receita', ids.p121, ids.p11, 'antes')
    ).toThrow(ErroMovimentoPlano)
  })

  it('permite subgrupo dentro de outro grupo', () => {
    const { estado } = executarMovimentoEmMemoria(
      base,
      'receita',
      ids.p121,
      ids.p11,
      'dentro'
    )

    expect(estado.get(ids.p121)!.parentId).toBe(ids.p11)
  })

  it('permite reordenar grupos entre si', () => {
    const { estado } = executarMovimentoEmMemoria(
      base,
      'receita',
      ids.p12,
      ids.p11,
      'antes'
    )

    expect(estado.get(ids.p12)!.parentId).toBeNull()
    expect(estado.get(ids.p12)!.codigo).toBe('1.1')
  })

  it('bloqueia aninhar dentro de subgrupo', () => {
    expect(() =>
      executarMovimentoEmMemoria(base, 'receita', ids.p121, ids.p111, 'dentro')
    ).toThrow(ErroMovimentoPlano)
  })

  it('bloqueia subgrupo com filhos ao tentar aninhar', () => {
    const comNeto = [
      { id: ids.p11, codigo: '1.1', parentId: null },
      { id: ids.p111, codigo: '1.1.1', parentId: ids.p11 },
      { id: 'id-neto', codigo: '1.1.1.1', parentId: ids.p111 },
      { id: ids.p12, codigo: '1.2', parentId: null },
    ]
    expect(() =>
      executarMovimentoEmMemoria(comNeto, 'receita', ids.p111, ids.p12, 'dentro')
    ).toThrow(ErroMovimentoPlano)
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
