import { describe, expect, it } from 'vitest'
import {
  coletarCodigosBarrasProduto,
  codigoBarrasGtinValido,
  normalizarCodigoBarrasGtin,
  validarCodigosBarrasInternos,
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

describe('validarCodigosBarrasInternos', () => {
  it('rejeita unidade igual a master no mesmo produto', () => {
    const codigos = coletarCodigosBarrasProduto('7894900011517', [
      { codigoBarras: '7894900011517' },
    ])
    expect(validarCodigosBarrasInternos(codigos)).toBe(false)
  })

  it('rejeita duas masters com o mesmo codigo', () => {
    const codigos = coletarCodigosBarrasProduto(undefined, [
      { codigoBarras: '10614141000415' },
      { codigoBarras: '10614141000415' },
    ])
    expect(validarCodigosBarrasInternos(codigos)).toBe(false)
  })

  it('aceita codigos distintos no mesmo produto', () => {
    const codigos = coletarCodigosBarrasProduto('7894900011517', [
      { codigoBarras: '10614141000415' },
    ])
    expect(validarCodigosBarrasInternos(codigos)).toBe(true)
  })
})
