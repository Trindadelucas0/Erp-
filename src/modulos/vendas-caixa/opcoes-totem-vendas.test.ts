import { describe, expect, it } from 'vitest'
import { unirParcelasCreditoTotem } from './opcoes-totem-vendas.js'

describe('unirParcelasCreditoTotem', () => {
  it('deduplica parcelas de vários cartões crédito', () => {
    const resultado = unirParcelasCreditoTotem([
      {
        ativo: true,
        tipo: 'credito',
        permitirParcelamento: true,
        adquirente: { ativo: true },
        taxas: [{ numeroParcelas: 1 }, { numeroParcelas: 3 }],
      },
      {
        ativo: true,
        tipo: 'credito',
        permitirParcelamento: true,
        adquirente: { ativo: true },
        taxas: [{ numeroParcelas: 3 }, { numeroParcelas: 6 }],
      },
    ])
    expect(resultado).toEqual([
      { numeroParcelas: 1 },
      { numeroParcelas: 3 },
      { numeroParcelas: 6 },
    ])
  })

  it('ignora cartão inativo ou adquirente inativa', () => {
    const resultado = unirParcelasCreditoTotem([
      {
        ativo: false,
        tipo: 'credito',
        permitirParcelamento: true,
        adquirente: { ativo: true },
        taxas: [{ numeroParcelas: 12 }],
      },
      {
        ativo: true,
        tipo: 'credito',
        permitirParcelamento: true,
        adquirente: { ativo: false },
        taxas: [{ numeroParcelas: 12 }],
      },
    ])
    expect(resultado).toEqual([])
  })

  it('sem parcelamento só inclui 1x', () => {
    const resultado = unirParcelasCreditoTotem([
      {
        ativo: true,
        tipo: 'credito',
        permitirParcelamento: false,
        adquirente: { ativo: true },
        taxas: [{ numeroParcelas: 1 }, { numeroParcelas: 6 }],
      },
    ])
    expect(resultado).toEqual([{ numeroParcelas: 1 }])
  })
})
