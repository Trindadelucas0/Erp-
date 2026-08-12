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

describe('resolverPlanoFinanceiroMercadoriaNfe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usa plano padrão do CFOP prevalente quando configurado e ativo', async () => {
    vi.mocked(clientePrisma.nfeRecebidaItem.findMany).mockResolvedValue([
      { cfopEntradaId: 'cfop-prev', valorTotal: 500, quantidade: 1, nItem: 1 },
    ] as never)
    vi.mocked(clientePrisma.cfop.findFirst).mockResolvedValue({
      planoFinanceiroPadraoId: 'plano-cfop',
      planoFinanceiroPadrao: { id: 'plano-cfop', ativo: true },
    } as never)

    const plano = await resolverPlanoFinanceiroMercadoriaNfe('company-1', {
      notaId: 'nota-1',
      fornecedorPessoaId: 'forn-1',
    })

    expect(plano).toBe('plano-cfop')
    expect(clientePrisma.pessoaPapel.findFirst).not.toHaveBeenCalled()
  })

  it('cai no par fornecedor+CFOP quando CFOP não tem plano padrão', async () => {
    vi.mocked(clientePrisma.nfeRecebidaItem.findMany).mockResolvedValue([
      { cfopEntradaId: 'cfop-prev', valorTotal: 500, quantidade: 1, nItem: 1 },
    ] as never)
    vi.mocked(clientePrisma.cfop.findFirst).mockResolvedValue({
      planoFinanceiroPadraoId: null,
      planoFinanceiroPadrao: null,
    } as never)
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: {
        paresPlanoCfopPadrao: [{ planoFinanceiroId: 'plano-par' }],
      },
    } as never)

    const plano = await resolverPlanoFinanceiroMercadoriaNfe('company-1', {
      notaId: 'nota-1',
      fornecedorPessoaId: 'forn-1',
    })

    expect(plano).toBe('plano-par')
  })

  it('cai no primeiro plano liberado do fornecedor quando nada mais está configurado', async () => {
    vi.mocked(clientePrisma.nfeRecebidaItem.findMany).mockResolvedValue([
      { cfopEntradaId: 'cfop-prev', valorTotal: 500, quantidade: 1, nItem: 1 },
    ] as never)
    vi.mocked(clientePrisma.cfop.findFirst).mockResolvedValue({
      planoFinanceiroPadraoId: null,
      planoFinanceiroPadrao: null,
    } as never)
    vi.mocked(clientePrisma.pessoaPapel.findFirst)
      .mockResolvedValueOnce({
        dadosFornecedor: { paresPlanoCfopPadrao: [] },
      } as never)
      .mockResolvedValueOnce({
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

  it('ignora plano inativo no CFOP e usa próximo fallback', async () => {
    vi.mocked(clientePrisma.nfeRecebidaItem.findMany).mockResolvedValue([
      { cfopEntradaId: 'cfop-prev', valorTotal: 500, quantidade: 1, nItem: 1 },
    ] as never)
    vi.mocked(clientePrisma.cfop.findFirst).mockResolvedValue({
      planoFinanceiroPadraoId: 'plano-inativo',
      planoFinanceiroPadrao: { id: 'plano-inativo', ativo: false },
    } as never)
    vi.mocked(clientePrisma.pessoaPapel.findFirst).mockResolvedValue({
      dadosFornecedor: {
        paresPlanoCfopPadrao: [{ planoFinanceiroId: 'plano-par' }],
      },
    } as never)

    const plano = await resolverPlanoFinanceiroMercadoriaNfe('company-1', {
      notaId: 'nota-1',
      fornecedorPessoaId: 'forn-1',
    })

    expect(plano).toBe('plano-par')
  })

  it('sem CFOP prevalente usa primeiro plano do fornecedor', async () => {
    vi.mocked(clientePrisma.nfeRecebidaItem.findMany).mockResolvedValue([
      { cfopEntradaId: null, valorTotal: 500, quantidade: 1, nItem: 1 },
    ] as never)
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
    expect(clientePrisma.cfop.findFirst).not.toHaveBeenCalled()
  })
})
