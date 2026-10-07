import { describe, expect, it } from 'vitest'
import { numeroNotaContaPagar } from './numero-nota-conta-pagar.js'

/** Chave fictícia 44 dígitos com nNF 000012345 nas posições 25–33. */
const CHAVE_44_NNF_12345 = '1'.repeat(25) + '000012345' + '1'.repeat(10)

describe('numeroNotaContaPagar', () => {
  it('origem cte ou manual retorna null', () => {
    expect(numeroNotaContaPagar('cte', CHAVE_44_NNF_12345, '99')).toBeNull()
    expect(numeroNotaContaPagar('manual', CHAVE_44_NNF_12345, '99')).toBeNull()
  })

  it('origem nfe com chave 44 dígitos extrai nNF sem zeros à esquerda', () => {
    const digitos = CHAVE_44_NNF_12345.replace(/\D/g, '')
    expect(digitos.length).toBe(44)
    expect(numeroNotaContaPagar('nfe', CHAVE_44_NNF_12345, null)).toBe('12345')
  })

  it('origem nfe sem chave válida usa numeroDocumento do título', () => {
    expect(numeroNotaContaPagar('nfe', '123', '710958')).toBe('710958')
    expect(numeroNotaContaPagar('nfe', null, '  ')).toBeNull()
  })
})
