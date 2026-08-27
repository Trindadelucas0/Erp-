import { describe, expect, it } from 'vitest'
import {
  competenciaDeData,
  competenciaEstaNaVigencia,
  filtrarRecorrenciasDaAgenda,
  filtrarRecorrenciasNaVigencia,
} from './vigencia-recorrencia.js'

const mensal = {
  id: 'm1',
  periodicidade: 'mensal',
  competenciaInicio: '2026-03',
  competenciaFim: '2026-08',
}

const mensalAberta = {
  id: 'm2',
  periodicidade: 'mensal',
  competenciaInicio: '2026-03',
  competenciaFim: null as string | null,
}

const anualMarco = {
  id: 'a1',
  periodicidade: 'anual',
  competenciaInicio: '2025-03',
  competenciaFim: null as string | null,
}

describe('competenciaEstaNaVigencia — mensal', () => {
  it('dentro da vigência', () => {
    expect(
      competenciaEstaNaVigencia({
        competencia: '2026-03',
        periodicidade: 'mensal',
        competenciaInicio: '2026-03',
        competenciaFim: '2026-08',
      })
    ).toBe(true)
    expect(
      competenciaEstaNaVigencia({
        competencia: '2026-08',
        periodicidade: 'mensal',
        competenciaInicio: '2026-03',
        competenciaFim: '2026-08',
      })
    ).toBe(true)
    expect(
      competenciaEstaNaVigencia({
        competencia: '2026-05',
        periodicidade: 'mensal',
        competenciaInicio: '2026-03',
        competenciaFim: '2026-08',
      })
    ).toBe(true)
  })

  it('fora da vigência (antes do início ou depois do fim)', () => {
    expect(
      competenciaEstaNaVigencia({
        competencia: '2026-02',
        periodicidade: 'mensal',
        competenciaInicio: '2026-03',
        competenciaFim: '2026-08',
      })
    ).toBe(false)
    expect(
      competenciaEstaNaVigencia({
        competencia: '2026-09',
        periodicidade: 'mensal',
        competenciaInicio: '2026-03',
        competenciaFim: '2026-08',
      })
    ).toBe(false)
  })

  it('sem fim permanece válida depois do início', () => {
    expect(
      competenciaEstaNaVigencia({
        competencia: '2027-01',
        periodicidade: 'mensal',
        competenciaInicio: '2026-03',
        competenciaFim: null,
      })
    ).toBe(true)
  })
})

describe('competenciaEstaNaVigencia — anual', () => {
  it('casa no mês de aniversário dentro da vigência', () => {
    expect(
      competenciaEstaNaVigencia({
        competencia: '2025-03',
        periodicidade: 'anual',
        competenciaInicio: '2025-03',
        competenciaFim: null,
      })
    ).toBe(true)
    expect(
      competenciaEstaNaVigencia({
        competencia: '2026-03',
        periodicidade: 'anual',
        competenciaInicio: '2025-03',
        competenciaFim: null,
      })
    ).toBe(true)
  })

  it('não casa em mês diferente do aniversário', () => {
    expect(
      competenciaEstaNaVigencia({
        competencia: '2026-04',
        periodicidade: 'anual',
        competenciaInicio: '2025-03',
        competenciaFim: null,
      })
    ).toBe(false)
    expect(
      competenciaEstaNaVigencia({
        competencia: '2025-12',
        periodicidade: 'anual',
        competenciaInicio: '2025-03',
        competenciaFim: null,
      })
    ).toBe(false)
  })

  it('aniversário depois do fim fica fora', () => {
    expect(
      competenciaEstaNaVigencia({
        competencia: '2027-03',
        periodicidade: 'anual',
        competenciaInicio: '2025-03',
        competenciaFim: '2026-12',
      })
    ).toBe(false)
  })
})

describe('filtrarRecorrenciasNaVigencia', () => {
  it('sem data de emissão → nenhuma regra (fluxo normal)', () => {
    expect(filtrarRecorrenciasNaVigencia([mensal, anualMarco], null)).toEqual([])
  })

  it('mensal dentro / anual no mês certo entram; o resto fica de fora', () => {
    const emissao = new Date('2026-03-15T12:00:00-03:00')
    const r = filtrarRecorrenciasNaVigencia([mensal, mensalAberta, anualMarco], emissao)
    expect(r.map((x) => x.id).sort()).toEqual(['a1', 'm1', 'm2'])
  })

  it('abril: mensal dentro entra; anual de março não', () => {
    const emissao = new Date('2026-04-10T12:00:00-03:00')
    const r = filtrarRecorrenciasNaVigencia([mensal, anualMarco], emissao)
    expect(r.map((x) => x.id)).toEqual(['m1'])
  })

  it('setembro: todas fora (mensal já encerrou; anual não é março)', () => {
    const emissao = new Date('2026-09-01T12:00:00-03:00')
    const r = filtrarRecorrenciasNaVigencia([mensal, anualMarco], emissao)
    expect(r).toEqual([])
  })
})

describe('filtrarRecorrenciasDaAgenda — competência filtra', () => {
  it('agenda de março inclui mensal vigente e anual de março', () => {
    const r = filtrarRecorrenciasDaAgenda([mensal, anualMarco], '2026-03')
    expect(r.map((x) => x.id).sort()).toEqual(['a1', 'm1'])
  })

  it('agenda de abril inclui só a mensal', () => {
    const r = filtrarRecorrenciasDaAgenda([mensal, anualMarco], '2026-04')
    expect(r.map((x) => x.id)).toEqual(['m1'])
  })

  it('agenda de setembro não inclui nenhuma', () => {
    const r = filtrarRecorrenciasDaAgenda([mensal, anualMarco], '2026-09')
    expect(r).toEqual([])
  })
})

describe('competenciaDeData', () => {
  it('usa o mês civil em Brasília', () => {
    expect(competenciaDeData(new Date('2026-03-01T12:00:00-03:00'))).toBe('2026-03')
    expect(competenciaDeData(new Date('2026-08-27T08:00:00-03:00'))).toBe('2026-08')
  })
})
