import { describe, expect, it } from 'vitest'
import {
  calcularPrecoUnitarioPreview,
  calcularQtdTotalUnVenda,
  preencherItemComProduto,
  recalcularCodigoUnidadeItem,
  resolverCodigoOriginal,
  resolverItensPorEmbalagem,
  resolverPrecoUnitario,
  resolverUnidadeEntrada,
  rotuloCampoPrecoEntrada,
  sugerirQuantidadeMultiplo,
} from './preencher-item-pedido-compra'

const produtoBase = {
  id: 'p1',
  nomeVenda: 'Produto A',
  sku: 'SKU1',
  marca: 'Marca X',
  unidade: 'UN',
  codigoOrigem: 'ORI1',
  precoCusto: 10.5,
  bloqueadoCompra: false,
  fornecedores: [
    {
      fornecedorPessoaId: 'f1',
      codigoFornecedor: 'CF1',
      unidadeEntrada: 'CX',
      multiploEntrada: 6,
      multiplicadorEntrada: 12,
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
    expect(item.produtoMarca).toBe('Marca X')
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
          multiploEntrada: null,
          multiplicadorEntrada: null,
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
          multiploEntrada: null,
          multiplicadorEntrada: null,
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

  it('resolverItensPorEmbalagem usa multiplicadorEntrada ou 1', () => {
    expect(resolverItensPorEmbalagem(produtoBase.fornecedores[0])).toBe(12)
    expect(resolverItensPorEmbalagem(undefined)).toBe(1)
    expect(
      resolverItensPorEmbalagem({
        fornecedorPessoaId: 'f1',
        codigoFornecedor: null,
        unidadeEntrada: null,
        multiplicadorEntrada: null,
      })
    ).toBe(1)
  })

  it('resolverItensPorEmbalagem usa vínculo do fornecedor do PO', () => {
    expect(resolverItensPorEmbalagem(produtoBase, 'f1')).toBe(12)
  })

  it('resolverItensPorEmbalagem não usa embalagem master como fallback', () => {
    const produto = {
      ...produtoBase,
      fornecedores: [
        {
          fornecedorPessoaId: 'f1',
          codigoFornecedor: null,
          unidadeEntrada: 'CX',
          multiploEntrada: null,
          multiplicadorEntrada: null,
        },
      ],
      embalagensMaster: [{ quantidade: 6 }],
    }
    expect(resolverItensPorEmbalagem(produto, 'f1')).toBe(1)
  })

  it('resolverItensPorEmbalagem não usa multiplicador de outro fornecedor', () => {
    const produto = {
      ...produtoBase,
      fornecedores: [
        {
          fornecedorPessoaId: 'f1',
          codigoFornecedor: null,
          unidadeEntrada: null,
          multiploEntrada: null,
          multiplicadorEntrada: null,
        },
        {
          fornecedorPessoaId: 'f2',
          codigoFornecedor: null,
          unidadeEntrada: 'CX',
          multiploEntrada: null,
          multiplicadorEntrada: 8,
        },
      ],
      embalagensMaster: [],
    }
    expect(resolverItensPorEmbalagem(produto, 'f1')).toBe(1)
  })

  it('resolverItensPorEmbalagem não puxa embalagem de outro fornecedor no PO', () => {
    const produto = {
      ...produtoBase,
      fornecedores: [
        {
          fornecedorPessoaId: 'resicola',
          codigoFornecedor: null,
          unidadeEntrada: 'CX',
          multiploEntrada: null,
          multiplicadorEntrada: 25,
        },
        {
          fornecedorPessoaId: 'fortlev',
          codigoFornecedor: null,
          unidadeEntrada: 'UN',
          multiploEntrada: null,
          multiplicadorEntrada: null,
        },
      ],
      embalagensMaster: [{ quantidade: 25 }],
    }
    expect(resolverItensPorEmbalagem(produto, 'fortlev')).toBe(1)
    expect(resolverItensPorEmbalagem(produto, 'resicola')).toBe(25)
  })

  it('resolverItensPorEmbalagem retorna 1 sem dados', () => {
    const produto = {
      ...produtoBase,
      fornecedores: [],
      embalagensMaster: [],
    }
    expect(resolverItensPorEmbalagem(produto, 'f1')).toBe(1)
  })

  it('calcularQtdTotalUnVenda multiplica quantidade por embalagem', () => {
    expect(calcularQtdTotalUnVenda(2, 12)).toBe(24)
  })

  it('rotuloCampoPrecoEntrada distingue embalagem e unitário', () => {
    expect(rotuloCampoPrecoEntrada(6)).toBe('Preço da embalagem')
    expect(rotuloCampoPrecoEntrada(1)).toBe('Preço unitário')
  })

  it('calcularPrecoUnitarioPreview divide pelo fator quando embalagem', () => {
    expect(calcularPrecoUnitarioPreview(60, 6)).toBe(10)
    expect(calcularPrecoUnitarioPreview(60, 1)).toBeNull()
    expect(calcularPrecoUnitarioPreview(-1, 6)).toBeNull()
  })

  it('sugerirQuantidadeMultiplo sugere próximo múltiplo para cima', () => {
    expect(sugerirQuantidadeMultiplo(3, 6)).toEqual({
      precisaAjuste: true,
      quantidadeSugerida: 6,
      multiplo: 6,
    })
    expect(sugerirQuantidadeMultiplo(6, 6)).toBeNull()
    expect(sugerirQuantidadeMultiplo(4, 1)).toBeNull()
    expect(sugerirQuantidadeMultiplo(4, null)).toBeNull()
  })

  it('recalcula unidade e código ao trocar fornecedor', () => {
    const produto = {
      ...produtoBase,
      fornecedores: [
        {
          fornecedorPessoaId: 'f1',
          codigoFornecedor: 'CF1',
          unidadeEntrada: 'CX',
          multiploEntrada: 6,
          multiplicadorEntrada: 12,
        },
        {
          fornecedorPessoaId: 'f2',
          codigoFornecedor: 'CF2',
          unidadeEntrada: 'PC',
          multiploEntrada: null,
          multiplicadorEntrada: null,
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
