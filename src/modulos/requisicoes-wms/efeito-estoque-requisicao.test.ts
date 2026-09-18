import { describe, expect, it } from 'vitest'
import {
  chavesIdempotenciaEstoque,
  conferenciaCompleta,
  enderecoConfere,
  ORDEM_MOVIMENTOS_CONCLUIR,
  passosExigidos,
  produtoConfere,
  quantidadeConfere,
  tipoMoveKardexSeparacao,
} from './efeito-estoque-requisicao.js'

describe('efeito-estoque-requisicao', () => {
  it('só Separação move kardex', () => {
    expect(tipoMoveKardexSeparacao('separacao')).toBe(true)
    expect(tipoMoveKardexSeparacao('reposicao')).toBe(false)
    expect(tipoMoveKardexSeparacao('movimentacao')).toBe(false)
    expect(tipoMoveKardexSeparacao('inventario')).toBe(false)
    expect(tipoMoveKardexSeparacao('contagem_entrada')).toBe(false)
  })

  it('chaves de idempotência são estáveis por id', () => {
    expect(chavesIdempotenciaEstoque('abc')).toEqual({
      reserva: 'reqwms:abc:reserva',
      estornoReserva: 'reqwms:abc:reserva:estorno',
      saida: 'reqwms:abc:saida',
    })
  })

  it('concluir aplica estorno da reserva antes da saída física', () => {
    expect([...ORDEM_MOVIMENTOS_CONCLUIR]).toEqual(['estornoReserva', 'saida'])
  })

  it('Separação exige produto e qtd; origem/destino só se a OS tiver', () => {
    expect(
      passosExigidos({
        tipoOperacao: 'separacao',
        origemEnderecoId: null,
        destinoEnderecoId: null,
        produtoId: 'p1',
        quantidade: 10,
      })
    ).toEqual(['produto', 'quantidade'])
    expect(
      passosExigidos({
        tipoOperacao: 'separacao',
        origemEnderecoId: 'o1',
        destinoEnderecoId: 'd1',
        produtoId: 'p1',
        quantidade: 10,
      })
    ).toEqual(['origem', 'produto', 'quantidade', 'destino'])
  })

  it('Reposição exige os quatro passos', () => {
    expect(
      passosExigidos({
        tipoOperacao: 'reposicao',
        origemEnderecoId: 'o',
        destinoEnderecoId: 'd',
        produtoId: 'p',
        quantidade: 1,
      })
    ).toEqual(['origem', 'produto', 'quantidade', 'destino'])
  })

  it('Limpeza só origem se preenchida; conferência segue campos da OS', () => {
    expect(
      passosExigidos({
        tipoOperacao: 'limpeza',
        origemEnderecoId: 'o1',
        destinoEnderecoId: null,
        produtoId: null,
        quantidade: null,
      })
    ).toEqual(['origem'])
    expect(
      passosExigidos({
        tipoOperacao: 'conferencia',
        origemEnderecoId: 'o1',
        destinoEnderecoId: null,
        produtoId: 'p1',
        quantidade: null,
      })
    ).toEqual(['origem', 'produto'])
  })

  it('contagem_entrada não exige passos de conferência', () => {
    expect(
      passosExigidos({
        tipoOperacao: 'contagem_entrada',
        origemEnderecoId: 'o1',
        destinoEnderecoId: 'd1',
        produtoId: 'p1',
        quantidade: 10,
      })
    ).toEqual([])
  })

  it('conferência completa exige todos os passos persistidos', () => {
    const os = {
      tipoOperacao: 'separacao',
      origemEnderecoId: 'o1',
      destinoEnderecoId: null,
      produtoId: 'p1',
      quantidade: 2,
    }
    expect(
      conferenciaCompleta(os, {
        conferidoOrigemEm: new Date(),
        conferidoProdutoEm: null,
        conferidoDestinoEm: null,
        qtdExecutada: 2,
      })
    ).toBe(false)
    expect(
      conferenciaCompleta(os, {
        conferidoOrigemEm: new Date(),
        conferidoProdutoEm: new Date(),
        conferidoDestinoEm: null,
        qtdExecutada: 2,
      })
    ).toBe(true)
  })

  it('endereço ignora caixa e espaços; produto aceita SKU sem ponto, barras ou GTIN', () => {
    expect(enderecoConfere('A-RC-20-01-2-05', ' a-rc-20-01-2-05 ')).toBe(true)
    expect(enderecoConfere('A-RC-20-01-2-05', 'outro')).toBe(false)
    expect(
      produtoConfere({ sku: '9.325', codigoBarras: '789', gtin: '7890', informado: '9325' })
    ).toBe(true)
    expect(
      produtoConfere({ sku: 'ABC', codigoBarras: '7894900011517', gtin: null, informado: '7894900011517' })
    ).toBe(true)
    expect(
      produtoConfere({ sku: 'ABC', codigoBarras: null, gtin: 'GT99', informado: 'gt99' })
    ).toBe(true)
    expect(
      produtoConfere({ sku: 'ABC', codigoBarras: null, gtin: null, informado: 'XYZ' })
    ).toBe(false)
  })

  it('quantidade usa arredondamento do kardex', () => {
    expect(quantidadeConfere(10, 10)).toBe(true)
    expect(quantidadeConfere(10.00004, 10.00004)).toBe(true)
    expect(quantidadeConfere(10, 9)).toBe(false)
  })
})
