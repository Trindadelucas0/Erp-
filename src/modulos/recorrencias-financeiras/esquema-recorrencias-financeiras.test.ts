import { describe, expect, it } from 'vitest'
import {
  esquemaDeCriacaoDeRecorrencia,
  esquemaDiaVencimento,
  esquemaFiltroAgenda,
} from './esquema-recorrencias-financeiras.js'

const base = {
  fornecedorPessoaId: '11111111-1111-1111-1111-111111111111',
  valor: 2600,
  periodicidade: 'mensal' as const,
  diaVencimento: 10,
  competenciaInicio: '2026-03',
  competenciaFim: null,
}

describe('esquemaDiaVencimento', () => {
  it('aceita 1 e 28', () => {
    expect(esquemaDiaVencimento.parse(1)).toBe(1)
    expect(esquemaDiaVencimento.parse(28)).toBe(28)
    expect(esquemaDiaVencimento.parse('15')).toBe(15)
  })

  it('rejeita 0, 29 e decimal', () => {
    expect(esquemaDiaVencimento.safeParse(0).success).toBe(false)
    expect(esquemaDiaVencimento.safeParse(29).success).toBe(false)
    expect(esquemaDiaVencimento.safeParse(10.5).success).toBe(false)
  })
})

describe('esquemaDeCriacaoDeRecorrencia — vigência', () => {
  it('aceita fim igual ou posterior ao início', () => {
    expect(esquemaDeCriacaoDeRecorrencia.safeParse(base).success).toBe(true)
    expect(
      esquemaDeCriacaoDeRecorrencia.safeParse({
        ...base,
        competenciaFim: '2026-03',
      }).success
    ).toBe(true)
    expect(
      esquemaDeCriacaoDeRecorrencia.safeParse({
        ...base,
        competenciaFim: '2026-12',
      }).success
    ).toBe(true)
  })

  it('rejeita fim anterior ao início', () => {
    const r = esquemaDeCriacaoDeRecorrencia.safeParse({
      ...base,
      competenciaInicio: '2026-08',
      competenciaFim: '2026-03',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.errors[0]?.message).toMatch(/fim não pode ser anterior/i)
    }
  })

  it('rejeita periodicidade inválida', () => {
    expect(
      esquemaDeCriacaoDeRecorrencia.safeParse({
        ...base,
        periodicidade: 'trimestral',
      }).success
    ).toBe(false)
  })
})

describe('esquemaFiltroAgenda', () => {
  it('aceita YYYY-MM e rejeita inválido', () => {
    expect(esquemaFiltroAgenda.safeParse({ competencia: '2026-08' }).success).toBe(true)
    expect(esquemaFiltroAgenda.safeParse({ competencia: '2026-13' }).success).toBe(false)
    expect(esquemaFiltroAgenda.safeParse({ competencia: '08/2026' }).success).toBe(false)
    expect(esquemaFiltroAgenda.safeParse({}).success).toBe(false)
  })
})
