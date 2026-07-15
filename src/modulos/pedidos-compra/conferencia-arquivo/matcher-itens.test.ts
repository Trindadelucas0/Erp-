import { describe, expect, it } from 'vitest'
import { compararItensPedidoComArquivo } from './matcher-itens.js'
import type { ItemExtraido, ItemPedidoParaMatch } from './tipos-conferencia.js'

const opcoes = { limiarNome: 0.5, toleranciaPreco: 0.01 }

function itemPedido(overrides: Partial<ItemPedidoParaMatch> = {}): ItemPedidoParaMatch {
  return {
    produtoId: 'p1',
    sku: 'SKU001',
    nome: 'Parafuso Sextavado M8',
    codigoOriginal: null,
    codigoBarras: null,
    quantidade: 10,
    precoUnitario: 5,
    unidade: 'UN',
    fotoUrl: null,
    ...overrides,
  }
}

function itemArquivo(overrides: Partial<ItemExtraido> = {}): ItemExtraido {
  return {
    codigo: null,
    codigoBarras: null,
    ncm: null,
    descricao: 'Parafuso Sextavado M8',
    unidade: 'UN',
    quantidade: 10,
    precoUnitario: 5,
    precoUnitarioComImposto: null,
    valorTotalItem: null,
    ...overrides,
  }
}

describe('compararItensPedidoComArquivo', () => {
  it('casa por código de barras e não gera divergência quando valores batem', () => {
    const linhas = compararItensPedidoComArquivo(
      [itemPedido({ codigoBarras: '7891234567890' })],
      [itemArquivo({ codigoBarras: '7891234567890', codigo: 'X1' })],
      opcoes
    )

    expect(linhas).toHaveLength(1)
    expect(linhas[0].status).toBe('ok')
    expect(linhas[0].metodoMatch).toBe('codigo_barras')
  })

  it('casa por código original quando não há código de barras', () => {
    const linhas = compararItensPedidoComArquivo(
      [itemPedido({ codigoOriginal: 'FORN-123' })],
      [itemArquivo({ codigo: 'FORN-123' })],
      opcoes
    )

    expect(linhas[0].metodoMatch).toBe('codigo_original')
    expect(linhas[0].status).toBe('ok')
  })

  it('casa por nome quando não há código nenhum e aponta divergência de preço', () => {
    const linhas = compararItensPedidoComArquivo(
      [itemPedido()],
      [itemArquivo({ precoUnitario: 6 })],
      opcoes
    )

    expect(linhas[0].metodoMatch).toBe('nome_preco')
    expect(linhas[0].status).toBe('divergente')
    expect(linhas[0].divergencias[0].campo).toBe('precoUnitario')
  })

  it('marca item do pedido sem correspondência no arquivo', () => {
    const linhas = compararItensPedidoComArquivo(
      [itemPedido({ nome: 'Produto Totalmente Diferente XYZ' })],
      [itemArquivo({ descricao: 'Outro Produto Qualquer ABC' })],
      opcoes
    )

    expect(linhas.some((l) => l.status === 'sem_match_pedido')).toBe(true)
  })

  it('marca item extra do arquivo como sobra quando não há item de pedido correspondente', () => {
    const linhas = compararItensPedidoComArquivo(
      [],
      [itemArquivo()],
      opcoes
    )

    expect(linhas).toHaveLength(1)
    expect(linhas[0].status).toBe('sobra_arquivo')
  })

  it('detecta divergência de quantidade', () => {
    const linhas = compararItensPedidoComArquivo(
      [itemPedido({ codigoOriginal: 'C1', quantidade: 10 })],
      [itemArquivo({ codigo: 'C1', quantidade: 8 })],
      opcoes
    )

    expect(linhas[0].status).toBe('divergente')
    expect(linhas[0].divergencias.some((d) => d.campo === 'quantidade')).toBe(true)
  })
})
