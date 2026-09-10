import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  esquemaGravarParametrizacaoCustos,
  somarTotalVenda,
} from './esquema-parametrizacao-custos.js'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn(),
}))

vi.mock('./repositorio-parametrizacao-custos.js', () => ({
  repositorioParametrizacaoCustos: {
    buscarDaEmpresa: vi.fn(),
    upsert: vi.fn(),
  },
}))

import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { repositorioParametrizacaoCustos } from './repositorio-parametrizacao-custos.js'
import { servicoParametrizacaoCustos } from './servico-parametrizacao-custos.js'

const registroA = {
  id: 'param-a',
  companyId: 'empresa-a',
  pis: 1.65,
  cofins: 7.6,
  impRendaSupSimples: null,
  contribuicaoSocial: null,
  custoFixo: 2,
  comissao: null,
  jurosMensaisCustoFinanOperac: 1,
  aliquotaCbs: 0.9,
  aliquotaIbs: 0.1,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
} as NonNullable<Awaited<ReturnType<typeof repositorioParametrizacaoCustos.buscarDaEmpresa>>>

describe('esquema parametrização de custos', () => {
  it('rejeita percentual fora de 0–100', () => {
    expect(esquemaGravarParametrizacaoCustos.safeParse({ pis: 0 }).success).toBe(true)
    expect(esquemaGravarParametrizacaoCustos.safeParse({ pis: 100 }).success).toBe(true)
    expect(esquemaGravarParametrizacaoCustos.safeParse({ pis: -1 }).success).toBe(false)
    expect(esquemaGravarParametrizacaoCustos.safeParse({ pis: 101 }).success).toBe(false)
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

  it('upsert único da empresa da sessão', async () => {
    vi.mocked(repositorioParametrizacaoCustos.buscarDaEmpresa).mockResolvedValue(null)
    vi.mocked(repositorioParametrizacaoCustos.upsert).mockResolvedValue(registroA)

    const dados = esquemaGravarParametrizacaoCustos.parse({
      pis: 1.65,
      cofins: 7.6,
    })
    const r = await servicoParametrizacaoCustos.gravar('empresa-a', dados, 'user-1')

    expect(repositorioParametrizacaoCustos.upsert).toHaveBeenCalledWith(
      'empresa-a',
      expect.objectContaining({ pis: 1.65 })
    )
    expect(registrarAuditoria).toHaveBeenCalled()
    expect(r.totalVenda).toBeCloseTo(11.25)
  })

  it('IDOR: obter da empresa A não lê registro da empresa B', async () => {
    vi.mocked(repositorioParametrizacaoCustos.buscarDaEmpresa).mockImplementation(async (companyId) =>
      companyId === 'empresa-a' ? registroA : null
    )

    const daA = await servicoParametrizacaoCustos.obter('empresa-a')
    const daB = await servicoParametrizacaoCustos.obter('empresa-b')

    expect(repositorioParametrizacaoCustos.buscarDaEmpresa).toHaveBeenNthCalledWith(1, 'empresa-a')
    expect(repositorioParametrizacaoCustos.buscarDaEmpresa).toHaveBeenNthCalledWith(2, 'empresa-b')
    expect(daA.id).toBe('param-a')
    expect(daB.id).toBeNull()
    expect(daB.pis).toBeNull()
  })

  it('recusa empresa ativa ausente', async () => {
    await expect(servicoParametrizacaoCustos.obter('')).rejects.toMatchObject({
      message: 'Empresa ativa não informada',
      codigoHttp: 400,
    })
  })
})
