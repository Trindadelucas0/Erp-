import { describe, expect, it } from 'vitest'
import { normalizarSkuProduto } from './normalizar-sku.js'

describe('normalizarSkuProduto', () => {
  it('remove pontos do SKU', () => {
    expect(normalizarSkuProduto('9.325')).toBe('9325')
    expect(normalizarSkuProduto('13.694')).toBe('13694')
    expect(normalizarSkuProduto('1.234')).toBe('1234')
  })

  it('mantém SKU numérico sem ponto', () => {
    expect(normalizarSkuProduto('9325')).toBe('9325')
  })

  it('faz trim nas pontas', () => {
    expect(normalizarSkuProduto('  9.325  ')).toBe('9325')
  })

  it('retorna undefined para vazio ou só pontos', () => {
    expect(normalizarSkuProduto('')).toBeUndefined()
    expect(normalizarSkuProduto('   ')).toBeUndefined()
    expect(normalizarSkuProduto('...')).toBeUndefined()
    expect(normalizarSkuProduto(null)).toBeUndefined()
    expect(normalizarSkuProduto(undefined)).toBeUndefined()
  })

  it('preserva SKU alfanumérico sem ponto', () => {
    expect(normalizarSkuProduto('ABC-123')).toBe('ABC-123')
  })
})
