import { describe, expect, it } from 'vitest'
import { casarRecorrencia } from './casar-recorrencia.js'
import { filtrarRecorrenciasNaVigencia } from './vigencia-recorrencia.js'

const mensal2600 = {
  id: 'm1',
  valor: 2600,
  produtoId: 'p1',
  produtoNome: 'Limpeza',
  periodicidade: 'mensal',
  competenciaInicio: '2026-03',
  competenciaFim: '2026-08',
}

const anual150 = {
  id: 'a1',
  valor: 150,
  produtoId: 'p2',
  produtoNome: 'Seguro',
  periodicidade: 'anual',
  competenciaInicio: '2025-03',
  competenciaFim: null as string | null,
}

function casarComVigencia(
  dataEmissao: Date | null,
  valor: number,
  regras = [mensal2600, anual150]
) {
  const naVigencia = filtrarRecorrenciasNaVigencia(regras, dataEmissao)
  return casarRecorrencia({
    fornecedorPessoaId: 'f1',
    valorTotal: valor,
    recorrenciasAtivas: naVigencia,
  })
}

describe('match + vigência (gate do pipeline)', () => {
  it('mensal dentro da vigência e valor igual → casou', () => {
    const r = casarComVigencia(new Date('2026-05-10T12:00:00-03:00'), 2600)
    expect(r.status).toBe('casou')
    if (r.status === 'casou') expect(r.recorrencia.id).toBe('m1')
  })

  it('mensal fora da vigência → fluxo normal (sem_recorrencia)', () => {
    const r = casarComVigencia(new Date('2026-09-10T12:00:00-03:00'), 2600, [mensal2600])
    expect(r.status).toBe('sem_recorrencia')
  })

  it('anual no mês de aniversário e valor igual → casou', () => {
    const r = casarComVigencia(new Date('2026-03-20T12:00:00-03:00'), 150, [anual150])
    expect(r.status).toBe('casou')
    if (r.status === 'casou') expect(r.recorrencia.id).toBe('a1')
  })

  it('anual em mês errado → fluxo normal mesmo com valor igual', () => {
    const r = casarComVigencia(new Date('2026-04-20T12:00:00-03:00'), 150, [anual150])
    expect(r.status).toBe('sem_recorrencia')
  })

  it('valor divergente DENTRO da vigência → valor_divergente (bloqueia)', () => {
    const r = casarComVigencia(new Date('2026-05-10T12:00:00-03:00'), 2500, [mensal2600])
    expect(r.status).toBe('valor_divergente')
  })

  it('valor divergente FORA da vigência → não bloqueia', () => {
    const r = casarComVigencia(new Date('2026-09-10T12:00:00-03:00'), 2500, [mensal2600])
    expect(r.status).toBe('sem_recorrencia')
  })

  it('sem data de emissão → fluxo normal', () => {
    const r = casarComVigencia(null, 2600)
    expect(r.status).toBe('sem_recorrencia')
  })
})
