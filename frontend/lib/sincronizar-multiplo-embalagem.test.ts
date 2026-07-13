import { describe, expect, it } from 'vitest'
import {
  aplicarEmbalagemNoFormularioFornecedor,
  preencherMultiploSeVazio,
} from './sincronizar-multiplo-embalagem'

describe('aplicarEmbalagemNoFormularioFornecedor', () => {
  it('preenche múltiplo vazio quando embalagem é 6', () => {
    expect(
      aplicarEmbalagemNoFormularioFornecedor({
        multiplicadorEntradaAnterior: '',
        multiplicadorEntrada: '6',
        multiploEntradaAtual: '',
      })
    ).toEqual({ multiplicadorEntrada: '6', multiploEntrada: '6' })
  })

  it('acompanha digitar 12 quando múltiplo ainda espelhava a embalagem', () => {
    expect(
      aplicarEmbalagemNoFormularioFornecedor({
        multiplicadorEntradaAnterior: '1',
        multiplicadorEntrada: '12',
        multiploEntradaAtual: '1',
      })
    ).toEqual({ multiplicadorEntrada: '12', multiploEntrada: '12' })
  })

  it('não sobrescreve múltiplo customizado', () => {
    expect(
      aplicarEmbalagemNoFormularioFornecedor({
        multiplicadorEntradaAnterior: '6',
        multiplicadorEntrada: '8',
        multiploEntradaAtual: '12',
      })
    ).toEqual({ multiplicadorEntrada: '8', multiploEntrada: '12' })
  })

  it('não apaga múltiplo ao limpar embalagem', () => {
    expect(
      aplicarEmbalagemNoFormularioFornecedor({
        multiplicadorEntradaAnterior: '6',
        multiplicadorEntrada: '',
        multiploEntradaAtual: '6',
      })
    ).toEqual({ multiplicadorEntrada: '', multiploEntrada: '6' })
  })
})

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
