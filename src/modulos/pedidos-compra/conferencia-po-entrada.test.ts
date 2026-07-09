import { describe, expect, it } from 'vitest'
import { conferirPedidoCompraComEntrada } from './conferencia-po-entrada.js'

describe('conferirPedidoCompraComEntrada', () => {
  const pedido = {
    condicaoPagamento: '30/60/90',
    transportadoraPessoaId: 'trans-1',
    modalidadeTransporte: 'CIF',
    itens: [
      { produtoId: 'prod-1', precoUnitario: 10.5, produto: { nomeVenda: 'Produto A' } },
    ],
  }

  it('não retorna divergências quando dados coincidem', () => {
    const divergencias = conferirPedidoCompraComEntrada(pedido, {
      condicaoPagamento: '30/60/90',
      transportadoraPessoaId: 'trans-1',
      modalidadeTransporte: 'CIF',
      itens: [{ produtoId: 'prod-1', precoUnitario: 10.5 }],
    })
    expect(divergencias).toHaveLength(0)
  })

  it('detecta divergência de preço acima da tolerância', () => {
    const divergencias = conferirPedidoCompraComEntrada(pedido, {
      itens: [{ produtoId: 'prod-1', precoUnitario: 11 }],
    })
    expect(divergencias.some((d) => d.tipo === 'preco')).toBe(true)
  })

  it('detecta divergência de condição de pagamento', () => {
    const divergencias = conferirPedidoCompraComEntrada(pedido, {
      condicaoPagamento: 'À vista',
      itens: [],
    })
    expect(divergencias.some((d) => d.tipo === 'condicao_pagamento')).toBe(true)
  })

  it('detecta divergência de modalidade de transporte', () => {
    const divergencias = conferirPedidoCompraComEntrada(pedido, {
      modalidadeTransporte: 'FOB',
      itens: [],
    })
    expect(divergencias.some((d) => d.tipo === 'modalidade_transporte')).toBe(true)
  })

  it('trata RETIRA legado do pedido como equivalente a CIF na conferência', () => {
    const divergencias = conferirPedidoCompraComEntrada(
      { ...pedido, modalidadeTransporte: 'RETIRA' },
      {
        modalidadeTransporte: 'CIF',
        itens: [],
      }
    )
    expect(divergencias.some((d) => d.tipo === 'modalidade_transporte')).toBe(false)
  })

  it('trata RETIRA legado da NF como equivalente a CIF na conferência', () => {
    const divergencias = conferirPedidoCompraComEntrada(pedido, {
      modalidadeTransporte: 'RETIRA',
      itens: [],
    })
    expect(divergencias.some((d) => d.tipo === 'modalidade_transporte')).toBe(false)
  })
})
