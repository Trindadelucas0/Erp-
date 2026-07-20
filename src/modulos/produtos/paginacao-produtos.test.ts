import { describe, expect, it } from 'vitest'
import {
  calcularSkipProdutos,
  LIMITE_MAX_IDS_PRODUTOS,
  LIMITE_PADRAO_PRODUTOS,
  normalizarLimiteProdutos,
  normalizarOrdenacaoProdutos,
  normalizarPaginaProdutos,
  parseIdsProdutos,
} from './paginacao-produtos.js'

describe('paginacao-produtos', () => {
  it('normaliza limite para whitelist e default 50', () => {
    expect(normalizarLimiteProdutos(undefined)).toBe(LIMITE_PADRAO_PRODUTOS)
    expect(normalizarLimiteProdutos(10)).toBe(10)
    expect(normalizarLimiteProdutos(25)).toBe(25)
    expect(normalizarLimiteProdutos(50)).toBe(50)
    expect(normalizarLimiteProdutos(100)).toBe(100)
    expect(normalizarLimiteProdutos(999)).toBe(LIMITE_PADRAO_PRODUTOS)
    expect(normalizarLimiteProdutos(0)).toBe(LIMITE_PADRAO_PRODUTOS)
  })

  it('normaliza pagina para inteiro >= 1', () => {
    expect(normalizarPaginaProdutos(undefined)).toBe(1)
    expect(normalizarPaginaProdutos(0)).toBe(1)
    expect(normalizarPaginaProdutos(-3)).toBe(1)
    expect(normalizarPaginaProdutos(2.9)).toBe(2)
    expect(normalizarPaginaProdutos(3)).toBe(3)
  })

  it('calcula skip a partir de pagina e limite (nunca ilimitado)', () => {
    expect(calcularSkipProdutos(1, 50)).toBe(0)
    expect(calcularSkipProdutos(2, 50)).toBe(50)
    expect(calcularSkipProdutos(3, 10)).toBe(20)
  })

  it('parseia ids CSV com teto de 200', () => {
    expect(parseIdsProdutos(undefined)).toEqual([])
    expect(parseIdsProdutos(' a , b ,a ')).toEqual(['a', 'b'])
    const muitos = Array.from({ length: LIMITE_MAX_IDS_PRODUTOS + 10 }, (_, i) =>
      String(i)
    )
    expect(parseIdsProdutos(muitos.join(','))).toHaveLength(LIMITE_MAX_IDS_PRODUTOS)
  })

  it('normaliza ordenacao com defaults seguros', () => {
    expect(normalizarOrdenacaoProdutos(undefined, undefined)).toEqual({
      ordenarPor: 'nomeVenda',
      direcao: 'asc',
    })
    expect(normalizarOrdenacaoProdutos('sku', 'desc')).toEqual({
      ordenarPor: 'sku',
      direcao: 'desc',
    })
    expect(normalizarOrdenacaoProdutos('unidade', 'asc')).toEqual({
      ordenarPor: 'unidade',
      direcao: 'asc',
    })
    expect(normalizarOrdenacaoProdutos('campoInvalido', 'ASC')).toEqual({
      ordenarPor: 'nomeVenda',
      direcao: 'asc',
    })
  })
})