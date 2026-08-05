import { describe, expect, it } from 'vitest'
import { filtrarProdutos, type ProdutoOpcao } from '@/components/pedidos-compra/combobox-produto'

const produtos: ProdutoOpcao[] = [
  {
    id: '1',
    nomeVenda: 'ADITIVO COLANTE',
    sku: '12345',
    unidade: 'UN',
    codigoBarras: '7894900011517',
    codigosBarrasEmbalagem: ['10614141000415'],
  },
  {
    id: '2',
    nomeVenda: 'OUTRO PRODUTO',
    sku: '99999',
    unidade: 'CX',
    codigoBarras: null,
    codigosBarrasEmbalagem: [],
  },
  {
    id: '3',
    nomeVenda: 'TUBO ESGOTO PVC 75MM',
    sku: 'ESG75',
    unidade: 'UN',
    codigoBarras: null,
    codigosBarrasEmbalagem: [],
  },
]

function gerarProdutos(quantidade: number): ProdutoOpcao[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    id: String(i + 1),
    nomeVenda: `PRODUTO TESTE ${i + 1}`,
    sku: String(10000 + i),
    unidade: 'UN',
    codigoBarras: null,
    codigosBarrasEmbalagem: [],
  }))
}

describe('filtrarProdutos', () => {
  it('filtra por nome sem diferenciar maiúsculas', () => {
    expect(filtrarProdutos(produtos, 'COLANTE')).toHaveLength(1)
    expect(filtrarProdutos(produtos, 'colante')[0]?.id).toBe('1')
  })

  it('filtra por nome', () => {
    expect(filtrarProdutos(produtos, 'colante')).toHaveLength(1)
    expect(filtrarProdutos(produtos, 'colante')[0]?.id).toBe('1')
  })

  it('filtra por SKU', () => {
    expect(filtrarProdutos(produtos, '99999')).toHaveLength(1)
    expect(filtrarProdutos(produtos, '99999')[0]?.id).toBe('2')
  })

  it('filtra por código de barras da unidade', () => {
    expect(filtrarProdutos(produtos, '7894900011517')).toHaveLength(1)
    expect(filtrarProdutos(produtos, '7894900011517')[0]?.id).toBe('1')
  })

  it('filtra por código de barras da embalagem master', () => {
    expect(filtrarProdutos(produtos, '10614141000415')).toHaveLength(1)
    expect(filtrarProdutos(produtos, '10614141000415')[0]?.id).toBe('1')
  })

  it('sem termo retorna todos os produtos sem truncar em 80', () => {
    const lista = gerarProdutos(100)
    expect(filtrarProdutos(lista, '')).toHaveLength(100)
  })

  it('com termo amplo retorna todos os matches sem truncar em 80', () => {
    const lista = gerarProdutos(100)
    expect(filtrarProdutos(lista, 'PRODUTO TESTE')).toHaveLength(100)
  })

  it('exige todas as palavras-chave (AND) mesmo separadas no nome', () => {
    expect(filtrarProdutos(produtos, 'esgoto 75')).toHaveLength(1)
    expect(filtrarProdutos(produtos, 'esgoto 75')[0]?.id).toBe('3')
  })

  it('aceita trecho parcial da palavra', () => {
    expect(filtrarProdutos(produtos, 'esg')).toHaveLength(1)
    expect(filtrarProdutos(produtos, 'esg')[0]?.id).toBe('3')
  })

  it('permite tokens em campos diferentes (nome + sku)', () => {
    expect(filtrarProdutos(produtos, 'tubo esg75')).toHaveLength(1)
    expect(filtrarProdutos(produtos, 'tubo esg75')[0]?.id).toBe('3')
  })
})
