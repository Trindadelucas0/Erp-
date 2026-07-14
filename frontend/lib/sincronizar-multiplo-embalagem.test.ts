import { describe, expect, it } from 'vitest'
import { preencherMultiploSeVazio } from './sincronizar-multiplo-embalagem'

describe('preencherMultiploSeVazio', () => {
  it('copia embalagem para múltiplo quando múltiplo está vazio', () => {
    expect(
      preencherMultiploSeVazio({
        multiplicadorEntrada: 6,
        multiploEntrada: null,
      })
    ).toEqual({ multiplicadorEntrada: 6, multiploEntrada: 6 })
  })

  it('mantém múltiplo existente', () => {
    expect(
      preencherMultiploSeVazio({
        multiplicadorEntrada: 6,
        multiploEntrada: 12,
      })
    ).toEqual({ multiplicadorEntrada: 6, multiploEntrada: 12 })
  })
})
