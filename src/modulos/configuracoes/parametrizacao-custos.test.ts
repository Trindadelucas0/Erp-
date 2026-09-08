import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  esquemaConsultaParametrizacaoCustos,
  esquemaGravarParametrizacaoCustos,
  somarTotalVenda,
} from './esquema-parametrizacao-custos.js'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn(),
}))

vi.mock('./repositorio-parametrizacao-custos.js', () => ({
  repositorioParametrizacaoCustos: {
    buscarPorCompetencia: vi.fn(),
    upsert: vi.fn(),
  },
}))

import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { repositorioParametrizacaoCustos } from './repositorio-parametrizacao-custos.js'
import { servicoParametrizacaoCustos } from './servico-parametrizacao-custos.js'

const registroA = {
  id: 'param-a',
  companyId: 'empresa-a',
  competencia: '2026-09',
  pis: 1.65,
  cofins: 7.6,
  impRendaSupSimples: null,
  contribuicaoSocial: null,
  custoFixo: 2,
  comissao: null,
  jurosMensaisCustoFinanOperac: 1,
  aliquotaCbs: 0.9,
  aliquotaIbs: 0.1,
}

describe('esquema parametrização de custos', () => {
  it('aceita YYYY-MM e rejeita competência inválida', () => {
    expect(esquemaConsultaParametrizacaoCustos.safeParse({ competencia: '2026-09' }).success).toBe(
      true
    )
    expect(esquemaConsultaParametrizacaoCustos.safeParse({ competencia: '2026-13' }).success).toBe(
      false
    )
    expect(esquemaConsultaParametrizacaoCustos.safeParse({ competencia: '09/2026' }).success).toBe(
      false
    )
  })

  it('rejeita percentual fora de 0–100', () => {
    const base = { competencia: '2026-09' }
    expect(esquemaGravarParametrizacaoCustos.safeParse({ ...base, pis: 0 }).success).toBe(true)
    expect(esquemaGravarParametrizacaoCustos.safeParse({ ...base, pis: 100 }).success).toBe(true)
    expect(esquemaGravarParametrizacaoCustos.safeParse({ ...base, pis: -1 }).success).toBe(false)
    expect(esquemaGravarParametrizacaoCustos.safeParse({ ...base, pis: 101 }).success).toBe(false)
  })

  it('Total da venda soma só PIS, COFINS, IR/SIMPLES, CS, custo fixo e comissão', () => {
    expect(
      somarTotalVenda({
        pis: 1,
        cofins: 2,
        impRendaSupSimples: 3,
        contribuicaoSocial: 4,
        custoFixo: 5,
        comissao: 6,
      })
    ).toBe(21)
  })
})

describe('servicoParametrizacaoCustos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upsert por competência da empresa da sessão', async () => {
    vi.mocked(repositorioParametrizacaoCustos.buscarPorCompetencia).mockResolvedValue(null)
    vi.mocked(repositorioParametrizacaoCustos.upsert).mockResolvedValue(registroA)

    const dados = esquemaGravarParametrizacaoCustos.parse({
      competencia: '2026-09',
      pis: 1.65,
      cofins: 7.6,
    })
    const r = await servicoParametrizacaoCustos.gravar('empresa-a', dados, 'user-1')

    expect(repositorioParametrizacaoCustos.upsert).toHaveBeenCalledWith(
      'empresa-a',
      expect.objectContaining({ competencia: '2026-09', pis: 1.65 })
    )
    expect(registrarAuditoria).toHaveBeenCalled()
    expect(r.totalVenda).toBeCloseTo(11.25)
  })

  it('IDOR: obter da empresa A não lê registro da empresa B', async () => {
    vi.mocked(repositorioParametrizacaoCustos.buscarPorCompetencia).mockImplementation(
      async (companyId) => (companyId === 'empresa-a' ? registroA : null)
    )

    const daA = await servicoParametrizacaoCustos.obter('empresa-a', '2026-09')
    const daB = await servicoParametrizacaoCustos.obter('empresa-b', '2026-09')

    expect(repositorioParametrizacaoCustos.buscarPorCompetencia).toHaveBeenNthCalledWith(
      1,
      'empresa-a',
      '2026-09'
    )
    expect(repositorioParametrizacaoCustos.buscarPorCompetencia).toHaveBeenNthCalledWith(
      2,
      'empresa-b',
      '2026-09'
    )
    expect(daA.id).toBe('param-a')
    expect(daB.id).toBeNull()
    expect(daB.pis).toBeNull()
  })

  it('recusa empresa ativa ausente', async () => {
    await expect(servicoParametrizacaoCustos.obter('', '2026-09')).rejects.toMatchObject({
      message: 'Empresa ativa não informada',
      codigoHttp: 400,
    })
  })
})
