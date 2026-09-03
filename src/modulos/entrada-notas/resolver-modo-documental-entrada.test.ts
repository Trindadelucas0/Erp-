import { describe, expect, it } from 'vitest'
import {
  finalidadeHabilitadaNoFornecedor,
  finalidadeUnicaDoFornecedor,
  inferirFinalidadeLegadoDasFlags,
  resolverFinalidadePreMarcacao,
  resolverModoDocumentalEntrada,
  statusPermiteTrocaFinalidade,
} from './resolver-modo-documental-entrada.js'

describe('resolverModoDocumentalEntrada', () => {
  it('null / indefinido → não documental (não assume revenda)', () => {
    expect(resolverModoDocumentalEntrada(null)).toBe(false)
    expect(resolverModoDocumentalEntrada(undefined)).toBe(false)
    expect(resolverModoDocumentalEntrada({})).toBe(false)
    expect(
      resolverModoDocumentalEntrada({ tipoDocumento: 'nfe55', finalidadeEntrada: null })
    ).toBe(false)
  })

  it('NFS-e é documental independentemente da finalidade', () => {
    expect(resolverModoDocumentalEntrada({ tipoDocumento: 'nfse' })).toBe(true)
    expect(
      resolverModoDocumentalEntrada({ tipoDocumento: 'nfse', finalidadeEntrada: 'revenda' })
    ).toBe(true)
  })

  it('finalidade uso_consumo → documental mesmo com tipoRevenda no fornecedor', () => {
    expect(
      resolverModoDocumentalEntrada({
        tipoDocumento: 'nfe55',
        finalidadeEntrada: 'uso_consumo',
      })
    ).toBe(true)
  })

  it('finalidade revenda → não documental mesmo com só Consumo no cadastro', () => {
    expect(
      resolverModoDocumentalEntrada({
        tipoDocumento: 'nfe55',
        finalidadeEntrada: 'revenda',
      })
    ).toBe(false)
  })

  it('Revenda+Consumo no fornecedor sem finalidade → não assume documental', () => {
    expect(
      resolverModoDocumentalEntrada({
        tipoDocumento: 'nfe55',
        finalidadeEntrada: null,
      })
    ).toBe(false)
  })
})

describe('finalidadeHabilitadaNoFornecedor', () => {
  it('Revenda exige tipoRevenda', () => {
    expect(finalidadeHabilitadaNoFornecedor('revenda', { tipoRevenda: true })).toBe(true)
    expect(finalidadeHabilitadaNoFornecedor('revenda', { tipoConsumo: true })).toBe(false)
    expect(finalidadeHabilitadaNoFornecedor('revenda', null)).toBe(false)
  })

  it('Uso e Consumo exige tipoConsumo ou tipoPrestadorServico', () => {
    expect(finalidadeHabilitadaNoFornecedor('uso_consumo', { tipoConsumo: true })).toBe(true)
    expect(
      finalidadeHabilitadaNoFornecedor('uso_consumo', { tipoPrestadorServico: true })
    ).toBe(true)
    expect(finalidadeHabilitadaNoFornecedor('uso_consumo', { tipoRevenda: true })).toBe(false)
  })
})

describe('finalidadeUnicaDoFornecedor', () => {
  it('só Revenda → revenda', () => {
    expect(finalidadeUnicaDoFornecedor({ tipoRevenda: true })).toBe('revenda')
    expect(
      finalidadeUnicaDoFornecedor({
        tipoRevenda: true,
        tipoConsumo: false,
        tipoPrestadorServico: false,
      })
    ).toBe('revenda')
  })

  it('só Consumo ou Prestador → uso_consumo', () => {
    expect(finalidadeUnicaDoFornecedor({ tipoConsumo: true })).toBe('uso_consumo')
    expect(finalidadeUnicaDoFornecedor({ tipoPrestadorServico: true })).toBe('uso_consumo')
  })

  it('os dois ou nenhum → null', () => {
    expect(finalidadeUnicaDoFornecedor({ tipoRevenda: true, tipoConsumo: true })).toBe(null)
    expect(
      finalidadeUnicaDoFornecedor({ tipoRevenda: true, tipoPrestadorServico: true })
    ).toBe(null)
    expect(finalidadeUnicaDoFornecedor({})).toBe(null)
    expect(finalidadeUnicaDoFornecedor(null)).toBe(null)
  })
})

describe('resolverFinalidadePreMarcacao', () => {
  it('null + único tipo → não grava (clique obrigatório)', () => {
    expect(resolverFinalidadePreMarcacao(null, { tipoRevenda: true })).toBeUndefined()
    expect(resolverFinalidadePreMarcacao(null, { tipoConsumo: true })).toBeUndefined()
  })

  it('null + dois tipos → não grava', () => {
    expect(
      resolverFinalidadePreMarcacao(null, { tipoRevenda: true, tipoConsumo: true })
    ).toBeUndefined()
  })

  it('já marcada e ainda habilitada → não sobrescreve', () => {
    expect(resolverFinalidadePreMarcacao('revenda', { tipoRevenda: true })).toBeUndefined()
    expect(
      resolverFinalidadePreMarcacao('revenda', { tipoRevenda: true, tipoConsumo: true })
    ).toBeUndefined()
  })

  it('marcada inválida + único tipo → limpa (não pré-marca o único)', () => {
    expect(resolverFinalidadePreMarcacao('revenda', { tipoConsumo: true })).toBe(null)
  })

  it('marcada inválida sem único → limpa', () => {
    expect(
      resolverFinalidadePreMarcacao('revenda', { tipoRevenda: false, tipoConsumo: false })
    ).toBe(null)
  })
})

describe('statusPermiteTrocaFinalidade', () => {
  it('troca em análise ok; pós-lançamento recusa', () => {
    expect(statusPermiteTrocaFinalidade('em_analise')).toBe(true)
    expect(statusPermiteTrocaFinalidade('pendente')).toBe(true)
    expect(statusPermiteTrocaFinalidade('stand_by')).toBe(true)
    expect(statusPermiteTrocaFinalidade('aguardando_chegada')).toBe(false)
    expect(statusPermiteTrocaFinalidade('entrada_consolidada')).toBe(false)
    expect(statusPermiteTrocaFinalidade('pronta_para_consolidar')).toBe(false)
  })
})

describe('inferirFinalidadeLegadoDasFlags (só backfill)', () => {
  it('espelha a regra antiga: Consumo sem Revenda e sem exigir itens → uso_consumo', () => {
    expect(
      inferirFinalidadeLegadoDasFlags({
        tipoRevenda: false,
        tipoConsumo: true,
        exigirItensEntrada: false,
      })
    ).toBe('uso_consumo')
    expect(
      inferirFinalidadeLegadoDasFlags({
        tipoRevenda: true,
        tipoConsumo: true,
        exigirItensEntrada: false,
      })
    ).toBe('revenda')
    expect(
      inferirFinalidadeLegadoDasFlags({
        tipoRevenda: false,
        tipoConsumo: true,
        exigirItensEntrada: true,
      })
    ).toBe('revenda')
  })
})
