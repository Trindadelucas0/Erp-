import { describe, expect, it } from 'vitest'
import { sugerirUnidadeLogisticaDeEntrada } from './sugerir-unidade-logistica'

describe('sugerirUnidadeLogisticaDeEntrada', () => {
  it('preenche logística vazia com unidade de entrada diferente da venda', () => {
    expect(
      sugerirUnidadeLogisticaDeEntrada({
        unidadeVenda: 'UN',
        unidadeLogisticaAtual: '',
        unidadeEntrada: 'CX',
      })
    ).toBe('CX')
  })

  it('não sobrescreve logística já preenchida', () => {
    expect(
      sugerirUnidadeLogisticaDeEntrada({
        unidadeVenda: 'UN',
        unidadeLogisticaAtual: 'FD',
        unidadeEntrada: 'CX',
      })
    ).toBe('FD')
  })

  it('não preenche quando entrada é igual à venda', () => {
    expect(
      sugerirUnidadeLogisticaDeEntrada({
        unidadeVenda: 'UN',
        unidadeLogisticaAtual: '',
        unidadeEntrada: 'UN',
      })
    ).toBe('')
  })
})
