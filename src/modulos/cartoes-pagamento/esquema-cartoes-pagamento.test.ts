import { describe, expect, it } from 'vitest'
import {
  esquemaDeCriacaoDeCartao,
  esquemaDeEdicaoDeCartao,
} from './esquema-cartoes-pagamento.js'

const adquirenteId = '11111111-1111-4111-8111-111111111111'

describe('esquema cartões de pagamento', () => {
  it('aceita mastercard crédito com várias parcelas', () => {
    const r = esquemaDeCriacaoDeCartao.safeParse({
      bandeira: 'mastercard',
      tipo: 'credito',
      nomeExibicao: 'Mastercard Crédito',
      adquirenteId,
      permitirParcelamento: true,
      taxas: [
        { numeroParcelas: 1, taxaPercentual: 3.49, prazoDias: 30, valorFixo: 0 },
        { numeroParcelas: 2, taxaPercentual: 4.29, prazoDias: 30, valorFixo: 0 },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('rejeita bandeira inválida', () => {
    const r = esquemaDeCriacaoDeCartao.safeParse({
      bandeira: 'diners',
      tipo: 'credito',
      nomeExibicao: 'Diners',
      adquirenteId,
      taxas: [{ numeroParcelas: 1, taxaPercentual: 1, prazoDias: 30, valorFixo: 0 }],
    })
    expect(r.success).toBe(false)
  })

  it('débito força sem parcelamento e 1 parcela', () => {
    const r = esquemaDeCriacaoDeCartao.safeParse({
      bandeira: 'visa',
      tipo: 'debito',
      nomeExibicao: 'Visa Débito',
      adquirenteId,
      permitirParcelamento: true,
      taxas: [
        { numeroParcelas: 1, taxaPercentual: 1.5, prazoDias: 1, valorFixo: 0 },
        { numeroParcelas: 2, taxaPercentual: 2, prazoDias: 30, valorFixo: 0 },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('débito válido com 1 taxa', () => {
    const r = esquemaDeCriacaoDeCartao.safeParse({
      bandeira: 'visa',
      tipo: 'debito',
      nomeExibicao: 'Visa Débito',
      adquirenteId,
      permitirParcelamento: false,
      taxas: [{ numeroParcelas: 1, taxaPercentual: 1.5, prazoDias: 1, valorFixo: 0 }],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.permitirParcelamento).toBe(false)
    }
  })

  it('rejeita parcelas duplicadas', () => {
    const r = esquemaDeEdicaoDeCartao.safeParse({
      bandeira: 'elo',
      tipo: 'credito',
      nomeExibicao: 'Elo Crédito',
      ativo: true,
      adquirenteId,
      permitirParcelamento: true,
      taxas: [
        { numeroParcelas: 1, taxaPercentual: 3, prazoDias: 30, valorFixo: 0 },
        { numeroParcelas: 1, taxaPercentual: 4, prazoDias: 30, valorFixo: 0 },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('aceita prazo de 15 dias fora da lista antiga', () => {
    const r = esquemaDeCriacaoDeCartao.safeParse({
      bandeira: 'visa',
      tipo: 'credito',
      nomeExibicao: 'Visa Crédito',
      adquirenteId,
      permitirParcelamento: false,
      taxas: [{ numeroParcelas: 1, taxaPercentual: 2, prazoDias: 15, valorFixo: 0 }],
    })
    expect(r.success).toBe(true)
  })

  it('rejeita prazo de 366 dias', () => {
    const r = esquemaDeCriacaoDeCartao.safeParse({
      bandeira: 'visa',
      tipo: 'credito',
      nomeExibicao: 'Visa Crédito',
      adquirenteId,
      permitirParcelamento: false,
      taxas: [{ numeroParcelas: 1, taxaPercentual: 2, prazoDias: 366, valorFixo: 0 }],
    })
    expect(r.success).toBe(false)
  })
})
