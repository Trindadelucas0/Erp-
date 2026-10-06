import { describe, expect, it } from 'vitest'
import { tipoCartaoTravado } from './trava-tipo-cartao'

const vazio = {
  cartaoJaSalvo: false,
  bandeira: '',
  nomeExibicao: '',
  adquirenteId: '',
  taxas: [{ numeroParcelas: 1, taxaPercentual: '0,00', prazoDias: 30, valorFixo: '0,00' }],
}

describe('tipoCartaoTravado', () => {
  it('formulário novo vazio não trava', () => {
    expect(tipoCartaoTravado(vazio)).toBe(false)
  })

  it('cartão já salvo trava', () => {
    expect(tipoCartaoTravado({ ...vazio, cartaoJaSalvo: true })).toBe(true)
  })

  it('bandeira preenchida trava', () => {
    expect(tipoCartaoTravado({ ...vazio, bandeira: 'visa' })).toBe(true)
  })

  it('nome preenchido trava', () => {
    expect(tipoCartaoTravado({ ...vazio, nomeExibicao: 'Visa Crédito' })).toBe(true)
  })

  it('adquirente preenchida trava', () => {
    expect(
      tipoCartaoTravado({
        ...vazio,
        adquirenteId: '11111111-1111-4111-8111-111111111111',
      })
    ).toBe(true)
  })

  it('taxa alterada trava', () => {
    expect(
      tipoCartaoTravado({
        ...vazio,
        taxas: [{ numeroParcelas: 1, taxaPercentual: '3,49', prazoDias: 30, valorFixo: '0,00' }],
      })
    ).toBe(true)
  })

  it('mais de uma linha de taxa trava', () => {
    expect(
      tipoCartaoTravado({
        ...vazio,
        taxas: [
          { numeroParcelas: 1, taxaPercentual: '0,00', prazoDias: 30, valorFixo: '0,00' },
          { numeroParcelas: 2, taxaPercentual: '0,00', prazoDias: 30, valorFixo: '0,00' },
        ],
      })
    ).toBe(true)
  })
})
