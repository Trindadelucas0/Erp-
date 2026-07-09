import { describe, expect, it } from 'vitest'
import { formVazio, validarCamposObrigatoriosLancamento } from './pedido-compra-shared'

describe('validarCamposObrigatoriosLancamento', () => {
  const formValido = {
    tipoCompra: 'revenda',
    dataFaturamento: '2026-07-01',
    previsaoEntrega: '2026-07-15',
  }

  it('aceita formulário com campos preenchidos', () => {
    expect(validarCamposObrigatoriosLancamento(formValido)).toBeNull()
  })

  it('exige tipo de compra válido', () => {
    expect(
      validarCamposObrigatoriosLancamento({ ...formValido, tipoCompra: '' })
    ).toBe('Selecione o tipo de compra.')
    expect(
      validarCamposObrigatoriosLancamento({ ...formValido, tipoCompra: 'invalido' })
    ).toBe('Selecione o tipo de compra.')
  })

  it('exige data de faturamento', () => {
    expect(
      validarCamposObrigatoriosLancamento({ ...formValido, dataFaturamento: '' })
    ).toBe('Informe a data de faturamento.')
  })

  it('exige previsão de entrega', () => {
    expect(
      validarCamposObrigatoriosLancamento({ ...formValido, previsaoEntrega: '' })
    ).toBe('Informe a previsão de entrega.')
  })

  it('formVazio sem datas retorna erro de faturamento', () => {
    expect(validarCamposObrigatoriosLancamento(formVazio)).toBe(
      'Informe a data de faturamento.'
    )
  })
})
