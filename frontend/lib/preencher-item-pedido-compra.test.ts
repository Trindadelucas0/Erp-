import { describe, expect, it } from 'vitest'
import {
  preencherItemComProduto,
  resolverPrecoUnitario,
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
    const item = preencherItemComProduto(
      {
        produtoId: '',
        codigoOriginal: '',
        quantidade: '1',
        unidade: 'UN',
        precoUnitario: '0',
        percentualDesconto: '5',
        valorDesconto: '1',
        outrasDespesas: '0',
        previsaoEntrega: '',
      },
      produtoBase,
      'f1',
      '2026-08-01'
    )
    expect(item.unidade).toBe('CX')
    expect(item.codigoOriginal).toBe('CF1')
    expect(item.precoUnitario).toBe('10.5')
    expect(item.origemPreco).toBe('estoque')
    expect(item.percentualDesconto).toBe('0')
    expect(item.previsaoEntrega).toBe('2026-08-01')
  })
})
