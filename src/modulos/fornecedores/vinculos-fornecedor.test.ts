import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    dadosFornecedor: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    fornecedorVinculo: {
      findMany: vi.fn(),
    },
  },
}))

import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { obterPessoaIdsRedePorPessoaId } from './vinculos-fornecedor.js'

describe('obterPessoaIdsRedePorPessoaId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna só a pessoa quando não há DadosFornecedor', async () => {
    vi.mocked(clientePrisma.dadosFornecedor.findFirst).mockResolvedValue(null)

    const ids = await obterPessoaIdsRedePorPessoaId('pessoa-a', 'company-1')

    expect(ids).toEqual(['pessoa-a'])
    expect(clientePrisma.fornecedorVinculo.findMany).not.toHaveBeenCalled()
  })

  it('inclui a própria pessoa na rede sem vínculos', async () => {
    vi.mocked(clientePrisma.dadosFornecedor.findFirst).mockResolvedValue({ id: 'df-a' } as never)
    vi.mocked(clientePrisma.dadosFornecedor.findMany)
      .mockResolvedValueOnce([{ id: 'df-a' }] as never) // carregarVinculosDaEmpresa
      .mockResolvedValueOnce([
        {
          id: 'df-a',
          papel: { pessoa: { id: 'pessoa-a', nome: 'A', cpf: null, cnpj: '111' } },
        },
      ] as never)
    vi.mocked(clientePrisma.fornecedorVinculo.findMany).mockResolvedValue([])

    const ids = await obterPessoaIdsRedePorPessoaId('pessoa-a', 'company-1')

    expect(ids).toEqual(['pessoa-a'])
  })

  it('inclui pessoaIds transitivos do grupo (A–B–C)', async () => {
    vi.mocked(clientePrisma.dadosFornecedor.findFirst).mockResolvedValue({ id: 'df-a' } as never)
    vi.mocked(clientePrisma.dadosFornecedor.findMany)
      .mockResolvedValueOnce([{ id: 'df-a' }, { id: 'df-b' }, { id: 'df-c' }] as never)
      .mockResolvedValueOnce([
        {
          id: 'df-a',
          papel: { pessoa: { id: 'pessoa-a', nome: 'A', cpf: null, cnpj: '111' } },
        },
        {
          id: 'df-b',
          papel: { pessoa: { id: 'pessoa-b', nome: 'B', cpf: null, cnpj: '222' } },
        },
        {
          id: 'df-c',
          papel: { pessoa: { id: 'pessoa-c', nome: 'C', cpf: null, cnpj: '333' } },
        },
      ] as never)
    vi.mocked(clientePrisma.fornecedorVinculo.findMany).mockResolvedValue([
      { fornecedorAId: 'df-a', fornecedorBId: 'df-b' },
      { fornecedorAId: 'df-b', fornecedorBId: 'df-c' },
    ] as never)

    const ids = await obterPessoaIdsRedePorPessoaId('pessoa-a', 'company-1')

    expect(ids.sort()).toEqual(['pessoa-a', 'pessoa-b', 'pessoa-c'].sort())
  })
})
