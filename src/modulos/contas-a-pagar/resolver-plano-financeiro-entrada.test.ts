import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    nfeRecebidaItem: { findMany: vi.fn() },
    cfop: { findFirst: vi.fn() },
    pessoaPapel: { findFirst: vi.fn() },
  },
}))

import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  cfopEntradaPrevalenteDosItens,
  parUnicoPlanoCfopFornecedor,
  resolverPlanoFinanceiroEntrada,
  resolverPlanoFinanceiroMercadoriaNfe,
} from './resolver-plano-financeiro-entrada.js'

describe('cfopEntradaPrevalenteDosItens', () => {
  it('escolhe CFOP com maior soma de valorTotal', () => {
    const resultado = cfopEntradaPrevalenteDosItens([
      { cfopEntradaId: 'cfop-a', valorTotal: 100, quantidade: 1, nItem: 1 },
      { cfopEntradaId: 'cfop-b', valorTotal: 250, quantidade: 2, nItem: 2 },
      { cfopEntradaId: 'cfop-a', valorTotal: 50, quantidade: 1, nItem: 3 },
    ])
    expect(resultado).toBe('cfop-b')
  })

  it('desempata por maior soma de quantidade', () => {
    const resultado = cfopEntradaPrevalenteDosItens([
      { cfopEntradaId: 'cfop-a', valorTotal: 100, quantidade: 3, nItem: 1 },
      { cfopEntradaId: 'cfop-b', valorTotal: 100, quantidade: 5, nItem: 2 },
    ])
    expect(resultado).toBe('cfop-b')
  })

  it('desempata por menor nItem quando valor e quantidade empatam', () => {
    const resultado = cfopEntradaPrevalenteDosItens([
      { cfopEntradaId: 'cfop-a', valorTotal: 100, quantidade: 2, nItem: 5 },
      { cfopEntradaId: 'cfop-b', valorTotal: 100, quantidade: 2, nItem: 2 },
    ])
    expect(resultado).toBe('cfop-b')
  })

  it('ignora itens sem cfopEntradaId', () => {
    const resultado = cfopEntradaPrevalenteDosItens([
      { cfopEntradaId: null, valorTotal: 999, quantidade: 10, nItem: 1 },
      { cfopEntradaId: 'cfop-a', valorTotal: 10, quantidade: 1, nItem: 2 },
    ])
    expect(resultado).toBe('cfop-a')
  })

  it('retorna null quando nenhum item tem cfopEntradaId', () => {
    expect(
      cfopEntradaPrevalenteDosItens([
        { cfopEntradaId: null, valorTotal: 100, quantidade: 1, nItem: 1 },
      ])
    ).toBeNull()
  })
})

describe('resolverPlanoFinanceiroEntrada — prioridade fornecedor → CFOP → null', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usa plano gravado na nota quando informado', async () => {
    const plano = await resolverPlanoFinanceiroEntrada('company-1', {
      notaId: 'nota-1',
      fornecedorPessoaId: 'forn-1',
      planoGravadoNaNota: 'plano-nota',
    })

    expect(plano).toBe('plano-nota')
    expect(clientePrisma.pessoaPapel.findFirst).not.toHaveBeenCalled()
  })

  it('prioriza primeiro plano do fornecedor sobre CFOP', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: {
        planosFinanceiros: [{ planoFinanceiroId: 'plano-forn' }],
      },
    } as never)

    const plano = await resolverPlanoFinanceiroEntrada('company-1', {
      notaId: 'nota-1',
      fornecedorPessoaId: 'forn-1',
      cfopEntradaId: 'cfop-prev',
    })

    expect(plano).toBe('plano-forn')
    expect(clientePrisma.cfop.findFirst).not.toHaveBeenCalled()
  })

  it('usa plano padrão do CFOP quando fornecedor não tem plano', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: { planosFinanceiros: [] },
    } as never)
    vi.mocked(clientePrisma.cfop.findFirst).mockResolvedValue({
      planoFinanceiroPadraoId: 'plano-cfop',
      planoFinanceiroPadrao: { id: 'plano-cfop', ativo: true },
    } as never)

    const plano = await resolverPlanoFinanceiroEntrada('company-1', {
      notaId: 'nota-1',
      fornecedorPessoaId: 'forn-1',
      cfopEntradaId: 'cfop-prev',
    })

    expect(plano).toBe('plano-cfop')
  })

  it('cai no par fornecedor+CFOP quando CFOP não tem plano padrão', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst)
      .mockResolvedValueOnce({
        dadosFornecedor: { planosFinanceiros: [] },
      } as never)
      .mockResolvedValueOnce({
        dadosFornecedor: {
          paresPlanoCfopPadrao: [{ planoFinanceiroId: 'plano-par' }],
        },
      } as never)
    vi.mocked(clientePrisma.cfop.findFirst).mockResolvedValue({
      planoFinanceiroPadraoId: null,
      planoFinanceiroPadrao: null,
    } as never)

    const plano = await resolverPlanoFinanceiroEntrada('company-1', {
      notaId: 'nota-1',
      fornecedorPessoaId: 'forn-1',
      cfopEntradaId: 'cfop-prev',
    })

    expect(plano).toBe('plano-par')
  })

  it('retorna null quando nada está configurado (escolha manual)', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: { planosFinanceiros: [] },
    } as never)
    vi.mocked(clientePrisma.nfeRecebidaItem.findMany).mockResolvedValue([
      { cfopEntradaId: null, valorTotal: 500, quantidade: 1, nItem: 1 },
    ] as never)

    const plano = await resolverPlanoFinanceiroEntrada('company-1', {
      notaId: 'nota-1',
      fornecedorPessoaId: 'forn-1',
    })

    expect(plano).toBeNull()
  })

  it('alias resolverPlanoFinanceiroMercadoriaNfe delega para resolverPlanoFinanceiroEntrada', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: {
        planosFinanceiros: [{ planoFinanceiroId: 'plano-forn' }],
      },
    } as never)

    const plano = await resolverPlanoFinanceiroMercadoriaNfe('company-1', {
      notaId: 'nota-1',
      fornecedorPessoaId: 'forn-1',
    })

    expect(plano).toBe('plano-forn')
  })
})

function parAtivo(overrides: {
  planoFinanceiroId?: string
  cfopId?: string
  cfop?: { ativo: boolean; natureza: string; companyId: string }
  planoFinanceiro?: { ativo: boolean; companyId: string }
} = {}) {
  return {
    planoFinanceiroId: overrides.planoFinanceiroId ?? 'plano-par',
    cfopId: overrides.cfopId ?? 'cfop-par',
    cfop: overrides.cfop ?? { ativo: true, natureza: 'entrada', companyId: 'company-1' },
    planoFinanceiro: overrides.planoFinanceiro ?? { ativo: true, companyId: 'company-1' },
  }
}

describe('parUnicoPlanoCfopFornecedor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna o par quando o fornecedor tem exatamente um par ativo', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: { paresPlanoCfopPadrao: [parAtivo()] },
    } as never)

    await expect(parUnicoPlanoCfopFornecedor('company-1', 'forn-1')).resolves.toEqual({
      planoFinanceiroId: 'plano-par',
      cfopId: 'cfop-par',
    })
  })

  it('retorna null sem fornecedor ou sem pares', async () => {
    expect(await parUnicoPlanoCfopFornecedor('company-1', null)).toBeNull()
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: { paresPlanoCfopPadrao: [] },
    } as never)
    expect(await parUnicoPlanoCfopFornecedor('company-1', 'forn-1')).toBeNull()
  })

  it('retorna null com dois ou mais pares', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: {
        paresPlanoCfopPadrao: [
          parAtivo({ cfopId: 'cfop-a', planoFinanceiroId: 'plano-a' }),
          parAtivo({ cfopId: 'cfop-b', planoFinanceiroId: 'plano-b' }),
        ],
      },
    } as never)

    expect(await parUnicoPlanoCfopFornecedor('company-1', 'forn-1')).toBeNull()
  })

  it('retorna null quando o CFOP está inativo ou não é de entrada', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: {
        paresPlanoCfopPadrao: [
          parAtivo({ cfop: { ativo: false, natureza: 'entrada', companyId: 'company-1' } }),
        ],
      },
    } as never)
    expect(await parUnicoPlanoCfopFornecedor('company-1', 'forn-1')).toBeNull()

    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: {
        paresPlanoCfopPadrao: [
          parAtivo({ cfop: { ativo: true, natureza: 'saida', companyId: 'company-1' } }),
        ],
      },
    } as never)
    expect(await parUnicoPlanoCfopFornecedor('company-1', 'forn-1')).toBeNull()
  })

  it('retorna null quando o plano está inativo', async () => {
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: {
        paresPlanoCfopPadrao: [
          parAtivo({ planoFinanceiro: { ativo: false, companyId: 'company-1' } }),
        ],
      },
    } as never)
    expect(await parUnicoPlanoCfopFornecedor('company-1', 'forn-1')).toBeNull()
  })
})
