import { describe, expect, it } from 'vitest'
import {
  esquemaFinanceiroFrete,
  esquemaParcelaFinanceiroFrete,
} from './esquema-entrada-notas.js'

describe('esquemaFinanceiroFrete — vencimento obrigatório (§7.4)', () => {
  it('rejeita 1 parcela sem vencimento', () => {
    const r = esquemaFinanceiroFrete.safeParse({
      parcelas: [{ numeroDocumento: '5406', vencimento: '', valor: 742.1 }],
    })
    expect(r.success).toBe(false)
  })

  it('rejeita 1 parcela com vencimento null', () => {
    const r = esquemaParcelaFinanceiroFrete.safeParse({
      numeroDocumento: '5406',
      vencimento: null,
      valor: 100,
    })
    expect(r.success).toBe(false)
  })

  it('aceita 1 parcela com vencimento', () => {
    const r = esquemaFinanceiroFrete.safeParse({
      parcelas: [{ numeroDocumento: '5406', vencimento: '2026-09-01', valor: 742.1 }],
    })
    expect(r.success).toBe(true)
  })

  it('rejeita formato legado sem vencimento', () => {
    const r = esquemaFinanceiroFrete.safeParse({
      numeroDocumento: '5406',
      valor: 100,
    })
    expect(r.success).toBe(false)
  })
})
