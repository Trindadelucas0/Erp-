import { describe, expect, it } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  calcularTotalLiquidoPedido,
  distribuirParcelasIguais,
  normalizarPrazosPagamento,
  validarSomaParcelasManual,
} from './parcelas-pagamento.js'

describe('distribuirParcelasIguais', () => {
  it('divide total em parcelas iguais com centavos na última', () => {
    expect(distribuirParcelasIguais(3, 300)).toEqual([100, 100, 100])
  })

  it('absorve diferença de centavos na última parcela', () => {
    expect(distribuirParcelasIguais(3, 100)).toEqual([33.33, 33.33, 33.34])
  })

  it('retorna array vazio quando não há parcelas', () => {
    expect(distribuirParcelasIguais(0, 100)).toEqual([])
  })

  it('retorna zeros quando total é zero', () => {
    expect(distribuirParcelasIguais(2, 0)).toEqual([0, 0])
  })
})

describe('calcularTotalLiquidoPedido', () => {
  it('soma itens, frete e subtrai crédito', () => {
    const total = calcularTotalLiquidoPedido(
      [{ quantidade: 2, precoUnitario: 50 }],
      10,
      5
    )
    expect(total).toBe(105)
  })
})

describe('normalizarPrazosPagamento', () => {
  const prazos = [
    { numero: 1, vencimento: '2026-08-01', valor: null },
    { numero: 2, vencimento: '2026-09-01', valor: null },
    { numero: 3, vencimento: '2026-10-01', valor: null },
  ]

  it('recalcula valores no rateio igual', () => {
    const result = normalizarPrazosPagamento(prazos, 'igual', 300)
    expect(result).toEqual([
      { numero: 1, vencimento: '2026-08-01', valor: 100 },
      { numero: 2, vencimento: '2026-09-01', valor: 100 },
      { numero: 3, vencimento: '2026-10-01', valor: 100 },
    ])
  })

  it('aceita rateio manual com soma correta', () => {
    const manual = [
      { numero: 1, vencimento: '2026-08-01', valor: 150 },
      { numero: 2, vencimento: '2026-09-01', valor: 100 },
      { numero: 3, vencimento: '2026-10-01', valor: 50 },
    ]
    const result = normalizarPrazosPagamento(manual, 'manual', 300)
    expect(result?.map((p) => p.valor)).toEqual([150, 100, 50])
  })

  it('rejeita manual com soma divergente', () => {
    const manual = [
      { numero: 1, vencimento: '2026-08-01', valor: 100 },
      { numero: 2, vencimento: '2026-09-01', valor: 100 },
    ]
    expect(() => normalizarPrazosPagamento(manual, 'manual', 300)).toThrow(ErroDaAplicacao)
  })

  it('rejeita manual com valor ausente', () => {
    const manual = [
      { numero: 1, vencimento: '2026-08-01', valor: 150 },
      { numero: 2, vencimento: '2026-09-01', valor: null },
    ]
    expect(() => normalizarPrazosPagamento(manual, 'manual', 150)).toThrow(ErroDaAplicacao)
  })

  it('ignora prazos sem vencimento', () => {
    const misto = [
      { numero: 1, vencimento: '2026-08-01', valor: null },
      { numero: 2, vencimento: '', valor: null },
    ]
    const result = normalizarPrazosPagamento(misto, 'igual', 100)
    expect(result).toEqual([{ numero: 1, vencimento: '2026-08-01', valor: 100 }])
  })
})

describe('validarSomaParcelasManual', () => {
  it('retorna null quando não há prazos com vencimento', () => {
    expect(validarSomaParcelasManual([{ vencimento: '' }], 100)).toBeNull()
  })

  it('retorna erro quando soma diverge', () => {
    const erro = validarSomaParcelasManual(
      [
        { vencimento: '2026-08-01', valor: 100 },
        { vencimento: '2026-09-01', valor: 100 },
      ],
      300
    )
    expect(erro).toMatch(/difere do total líquido/)
  })
})
