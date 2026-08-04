import { describe, expect, it } from 'vitest'
import {
  coletarCodigosBarrasProduto,
  codigoBarrasGtinValido,
  normalizarCodigoBarrasGtin,
  normalizarCodigoOriginalComparacao,
  validarCodigosBarrasInternos,
  variantesCodigoBarrasParaBusca,
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

describe('variantesCodigoBarrasParaBusca', () => {
  it('DUN-14 da NF (ex. fardo 3,6L) também busca EAN-13 (últimos 13)', () => {
    const dun14 = '27894174203803'
    expect(variantesCodigoBarrasParaBusca(dun14)).toEqual(['27894174203803', '7894174203803'])
  })

  it('EAN-13 também tenta GTIN-14 com indicador 0', () => {
    expect(variantesCodigoBarrasParaBusca('7894174200723')).toEqual([
      '7894174200723',
      '07894174200723',
    ])
  })

  it('ignora vazio / só zeros / não-dígitos', () => {
    expect(variantesCodigoBarrasParaBusca('')).toEqual([])
    expect(variantesCodigoBarrasParaBusca('abc')).toEqual([])
  })
})

describe('normalizarCodigoOriginalComparacao', () => {
  it('iguala cProd com pontos ao código sem pontos (caso Quartzolit)', () => {
    expect(normalizarCodigoOriginalComparacao('0563.00042.0360GL')).toBe('0563000420360GL')
    expect(normalizarCodigoOriginalComparacao('0563000420360GL')).toBe('0563000420360GL')
    expect(normalizarCodigoOriginalComparacao('0563-00042 0360gl')).toBe('0563000420360GL')
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
