import { describe, expect, it } from 'vitest'
import {
  resolverCodigoOriginal,
  resolverUnidadeCodigoItem,
  resolverUnidadeEntrada,
} from './resolver-item-fornecedor.js'

const produtoBase = {
  id: 'p1',
  unidade: 'UN',
  fornecedores: [
    {
      fornecedorPessoaId: 'f1',
      codigoFornecedor: 'CF1',
      unidadeEntrada: 'CX',
    },
  ],
}

describe('resolver-item-fornecedor', () => {
  it('usa unidade e código do vínculo fornecedor', () => {
    expect(resolverUnidadeCodigoItem(produtoBase, 'f1')).toEqual({
      unidade: 'CX',
      codigoOriginal: 'CF1',
    })
  })

  it('usa unidade de venda quando fornecedor não tem unidade de entrada', () => {
    const produto = {
      ...produtoBase,
      fornecedores: [
        {
          fornecedorPessoaId: 'f1',
          codigoFornecedor: 'CF1',
          unidadeEntrada: null,
        },
      ],
    }
    expect(resolverUnidadeEntrada(produto.fornecedores[0], 'UN')).toBe('UN')
    expect(resolverUnidadeCodigoItem(produto, 'f1').unidade).toBe('UN')
  })

  it('deixa código original vazio quando fornecedor não tem código', () => {
    const produto = {
      ...produtoBase,
      fornecedores: [
        {
          fornecedorPessoaId: 'f1',
          codigoFornecedor: null,
          unidadeEntrada: 'CX',
        },
      ],
    }
    expect(resolverCodigoOriginal(produto.fornecedores[0])).toBe('')
    expect(resolverUnidadeCodigoItem(produto, 'f1').codigoOriginal).toBe('')
  })

  it('usa unidade de venda e código vazio sem vínculo com fornecedor', () => {
    expect(resolverUnidadeCodigoItem(produtoBase, 'f2')).toEqual({
      unidade: 'UN',
      codigoOriginal: '',
    })
  })
})
