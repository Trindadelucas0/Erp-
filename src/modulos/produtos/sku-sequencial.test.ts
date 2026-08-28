import { describe, expect, it } from 'vitest'
import { calcularProximoSkuNumerico } from './sku-sequencial.js'

describe('calcularProximoSkuNumerico', () => {
  it('retorna 1 quando não há SKUs', () => {
    expect(calcularProximoSkuNumerico([])).toBe('1')
  })

  it('retorna 3 para SKUs 1 e 2', () => {
    expect(calcularProximoSkuNumerico(['1', '2'])).toBe('3')
  })

  it('ignora SKU alfanumérico e null', () => {
    expect(calcularProximoSkuNumerico(['ABC', null, '5', undefined])).toBe('6')
  })

  it('retorna 11 após 9 e 10', () => {
    expect(calcularProximoSkuNumerico(['9', '10'])).toBe('11')
  })

  it('considera SKU com ponto como separador visual', () => {
    expect(calcularProximoSkuNumerico(['9.325', '13694'])).toBe('13695')
    expect(calcularProximoSkuNumerico(['13.694'])).toBe('13695')
  })
})
