import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../requisicoes-wms/repositorio-requisicoes-wms.js', () => ({
  repositorioDeRequisicoesWms: {
    executarEmTransacao: vi.fn(),
    proximoNumero: vi.fn(),
  },
}))

import { repositorioDeRequisicoesWms } from '../requisicoes-wms/repositorio-requisicoes-wms.js'
import {
  agruparItensVenda,
  gerarOsSeparacaoDaVenda,
  TIPO_OS_SEPARACAO_VENDA,
} from './gerar-os-separacao-venda.js'

describe('gerar-os-separacao-venda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeRequisicoesWms.proximoNumero).mockResolvedValue(31)
  })

  it('agrupa quantidade do mesmo produto', () => {
    expect(
      agruparItensVenda([
        { produtoId: 'p1', quantidade: 2 },
        { produtoId: 'p1', quantidade: 3 },
        { produtoId: 'p2', quantidade: 1 },
        { produtoId: 'p3', quantidade: 0 },
      ])
    ).toEqual([
      { produtoId: 'p1', quantidade: 5 },
      { produtoId: 'p2', quantidade: 1 },
    ])
  })

  it('dois itens do mesmo produto viram uma ordem disponivel', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'os-1', numero: 31, produtoId: 'p1' })
    const tx = {
      requisicaoWms: {
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      },
    }
    const criadas = await gerarOsSeparacaoDaVenda({
      companyId: 'c1',
      vendaCaixaId: 'venda-1',
      numeroVenda: 14,
      usuarioId: 'u1',
      itens: [
        { produtoId: 'p1', quantidade: 4 },
        { produtoId: 'p1', quantidade: 6 },
      ],
      tx: tx as never,
    })
    expect(criadas).toEqual([{ id: 'os-1', numero: 31, produtoId: 'p1' }])
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoOperacao: TIPO_OS_SEPARACAO_VENDA,
          status: 'disponivel',
          prioridade: 3,
          responsavelId: null,
          produtoId: 'p1',
          quantidade: 10,
          observacao: 'Venda 14',
          vendaCaixaId: 'venda-1',
        }),
      })
    )
  })

  it('dois produtos distintos viram duas ordens', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ id: 'os-1', numero: 31, produtoId: 'p1' })
      .mockResolvedValueOnce({ id: 'os-2', numero: 32, produtoId: 'p2' })
    vi.mocked(repositorioDeRequisicoesWms.proximoNumero)
      .mockResolvedValueOnce(31)
      .mockResolvedValueOnce(32)
    const tx = {
      requisicaoWms: {
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      },
    }
    const criadas = await gerarOsSeparacaoDaVenda({
      companyId: 'c1',
      vendaCaixaId: 'venda-1',
      numeroVenda: 14,
      usuarioId: 'u1',
      itens: [
        { produtoId: 'p1', quantidade: 2 },
        { produtoId: 'p2', quantidade: 1 },
      ],
      tx: tx as never,
    })
    expect(criadas).toEqual([
      { id: 'os-1', numero: 31, produtoId: 'p1' },
      { id: 'os-2', numero: 32, produtoId: 'p2' },
    ])
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ status: 'disponivel', produtoId: 'p1', quantidade: 2 })
    )
    expect(create.mock.calls[1][0].data).toEqual(
      expect.objectContaining({ status: 'disponivel', produtoId: 'p2', quantidade: 1 })
    )
  })

  it('segundo passe no mesmo vendaCaixaId não cria outra ordem', async () => {
    const create = vi.fn()
    const tx = {
      requisicaoWms: {
        findFirst: vi.fn().mockResolvedValue({ id: 'os-1', numero: 31, produtoId: 'p1' }),
        create,
      },
    }
    const criadas = await gerarOsSeparacaoDaVenda({
      companyId: 'c1',
      vendaCaixaId: 'venda-1',
      numeroVenda: 14,
      usuarioId: 'u1',
      itens: [{ produtoId: 'p1', quantidade: 10 }],
      tx: tx as never,
    })
    expect(criadas).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })
})
