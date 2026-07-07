import { describe, expect, it } from 'vitest'
import {
  codigoBarrasGtinValido,
  normalizarCodigoBarrasGtin,
} from './codigo-barras-gtin.js'

describe('codigoBarrasGtinValido', () => {
  it('aceita EAN-13 válido', () => {
    expect(codigoBarrasGtinValido('5901234123457')).toBe(true)
    expect(codigoBarrasGtinValido('4006381333931')).toBe(true)
  })

  it('aceita GTIN-14 válido', () => {
    expect(codigoBarrasGtinValido('10614141000415')).toBe(true)
  })

  it('rejeita letras', () => {
    expect(codigoBarrasGtinValido('ASD')).toBe(false)
  })

  it('rejeita tamanho incorreto', () => {
    expect(codigoBarrasGtinValido('123456789012')).toBe(false)
    expect(codigoBarrasGtinValido('123456789012345')).toBe(false)
  })

  it('rejeita dígito verificador incorreto', () => {
    expect(codigoBarrasGtinValido('5901234123450')).toBe(false)
  })

  it('normaliza removendo não-dígitos', () => {
    expect(normalizarCodigoBarrasGtin('590-1234-12345-7')).toBe('5901234123457')
  })
})
