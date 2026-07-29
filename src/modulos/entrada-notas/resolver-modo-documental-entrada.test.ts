import { describe, expect, it } from 'vitest'
import { resolverModoDocumentalEntrada } from './resolver-modo-documental-entrada.js'

describe('resolverModoDocumentalEntrada', () => {
  it('retorna false sem flags / fornecedor', () => {
    expect(resolverModoDocumentalEntrada(null)).toBe(false)
    expect(resolverModoDocumentalEntrada(undefined)).toBe(false)
  })

  it('Revenda exige vínculo (não documental)', () => {
    expect(
      resolverModoDocumentalEntrada({
        tipoRevenda: true,
        tipoConsumo: false,
        tipoPrestadorServico: false,
        exigirItensEntrada: false,
      })
    ).toBe(false)
  })

  it('Consumo sem exigir itens → documental', () => {
    expect(
      resolverModoDocumentalEntrada({
        tipoRevenda: false,
        tipoConsumo: true,
        tipoPrestadorServico: false,
        exigirItensEntrada: false,
      })
    ).toBe(true)
  })

  it('Prestador sem exigir itens → documental', () => {
    expect(
      resolverModoDocumentalEntrada({
        tipoRevenda: false,
        tipoConsumo: false,
        tipoPrestadorServico: true,
        exigirItensEntrada: false,
      })
    ).toBe(true)
  })

  it('Consumo com exigir itens → NÃO documental', () => {
    expect(
      resolverModoDocumentalEntrada({
        tipoRevenda: false,
        tipoConsumo: true,
        tipoPrestadorServico: false,
        exigirItensEntrada: true,
      })
    ).toBe(false)
  })

  it('Consumo + Revenda → NÃO documental (revenda manda)', () => {
    expect(
      resolverModoDocumentalEntrada({
        tipoRevenda: true,
        tipoConsumo: true,
        tipoPrestadorServico: false,
        exigirItensEntrada: false,
      })
    ).toBe(false)
  })
})
