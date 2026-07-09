import { describe, expect, it } from 'vitest'
import {
  preencherItemComProduto,
  recalcularCodigoUnidadeItem,
  resolverCodigoOriginal,
  resolverPrecoUnitario,
  resolverUnidadeEntrada,
} from './preencher-item-pedido-compra'

const produtoBase = {
  id: 'p1',
  nomeVenda: 'Produto A',
  sku: 'SKU1',
  unidade: 'UN',
  codigoOrigem: 'ORI1',
  precoCusto: 10.5,
  bloqueadoCompra: false,
  fornecedores: [
    {
      fornecedorPessoaId: 'f1',
      codigoFornecedor: 'CF1',
      unidadeEntrada: 'CX',
    },
  ],
}

const itemBase = {
  produtoId: '',
  codigoOriginal: '',
  quantidade: '1',
  unidade: 'UN',
  precoUnitario: '0',
  percentualDesconto: '5',
  valorDesconto: '1',
  outrasDespesas: '0',
  previsaoEntrega: '',
}

describe('preencher-item-pedido-compra', () => {
  it('usa precoCusto do estoque quando disponível', () => {
    const r = resolverPrecoUnitario(10.5, [{ precoCusto: 5, precoUnitario: 4 }])
    expect(r).toEqual({ valor: '10.5', origem: 'estoque' })
  })

  it('usa histórico quando estoque vazio', () => {
    const r = resolverPrecoUnitario(null, [{ precoCusto: 7.25, precoUnitario: 6 }])
    expect(r).toEqual({ valor: '7.25', origem: 'historico' })
  })

  it('preenche item com vínculo do fornecedor', () => {
    const item = preencherItemComProduto(itemBase, produtoBase, 'f1', '2026-08-01')
    expect(item.unidade).toBe('CX')
    expect(item.codigoOriginal).toBe('CF1')
    expect(item.precoUnitario).toBe('10.5')
    expect(item.origemPreco).toBe('estoque')
    expect(item.percentualDesconto).toBe('0')
    expect(item.previsaoEntrega).toBe('2026-08-01')
  })

  it('usa unidade de venda quando fornecedor não tem unidade de entrada', () => {
    const produtoSemUnidadeEntrada = {
      ...produtoBase,
      fornecedores: [
        {
          fornecedorPessoaId: 'f1',
          codigoFornecedor: 'CF1',
          unidadeEntrada: null,
        },
      ],
    }
    const item = preencherItemComProduto(
      { ...itemBase, unidade: '' },
      produtoSemUnidadeEntrada,
      'f1',
      ''
    )
    expect(item.unidade).toBe('UN')
  })

  it('deixa código original vazio quando fornecedor não tem código cadastrado', () => {
    const produtoSemCodigo = {
      ...produtoBase,
      fornecedores: [
        {
          fornecedorPessoaId: 'f1',
          codigoFornecedor: null,
          unidadeEntrada: 'CX',
        },
      ],
    }
    const item = preencherItemComProduto(itemBase, produtoSemCodigo, 'f1', '')
    expect(item.codigoOriginal).toBe('')
    expect(item.unidade).toBe('CX')
  })

  it('não usa codigoOrigem do produto como fallback de código original', () => {
    const produtoSemVinculo = {
      ...produtoBase,
      fornecedores: [],
    }
    const item = preencherItemComProduto(itemBase, produtoSemVinculo, 'f1', '')
    expect(item.codigoOriginal).toBe('')
    expect(item.unidade).toBe('UN')
  })

  it('resolverCodigoOriginal retorna vazio sem vínculo', () => {
    expect(resolverCodigoOriginal(undefined)).toBe('')
  })

  it('resolverUnidadeEntrada usa unidade de venda sem vínculo', () => {
    expect(resolverUnidadeEntrada(undefined, 'UN')).toBe('UN')
  })

  it('recalcula unidade e código ao trocar fornecedor', () => {
    const produto = {
      ...produtoBase,
      fornecedores: [
        {
          fornecedorPessoaId: 'f1',
          codigoFornecedor: 'CF1',
          unidadeEntrada: 'CX',
        },
        {
          fornecedorPessoaId: 'f2',
          codigoFornecedor: 'CF2',
          unidadeEntrada: 'PC',
        },
      ],
    }
    const item = recalcularCodigoUnidadeItem(
      { ...itemBase, produtoId: 'p1', unidade: 'CX', codigoOriginal: 'CF1' },
      produto,
      'f2'
    )
    expect(item.unidade).toBe('PC')
    expect(item.codigoOriginal).toBe('CF2')
  })
})
