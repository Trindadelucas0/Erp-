import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-vendas-caixa.js', () => ({
  repositorioDeVendasCaixa: {
    listar: vi.fn(),
    executarEmTransacao: vi.fn(),
    proximoNumero: vi.fn(),
  },
}))

vi.mock('../requisicoes-wms/repositorio-requisicoes-wms.js', () => ({
  repositorioDeRequisicoesWms: {
    produtoDaEmpresa: vi.fn(),
  },
}))

import { repositorioDeRequisicoesWms } from '../requisicoes-wms/repositorio-requisicoes-wms.js'
import { repositorioDeVendasCaixa } from './repositorio-vendas-caixa.js'
import { servicoDeVendasCaixa } from './servico-vendas-caixa.js'

const PRODUTO = '11111111-1111-4111-8111-111111111111'

describe('servico-vendas-caixa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sem cliente não chama o repositório', async () => {
    await expect(
      servicoDeVendasCaixa.confirmarPagamento('c1', 'u1', {
        clienteNome: '   ',
        itens: [{ produtoId: PRODUTO, quantidade: 1 }],
      })
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(repositorioDeVendasCaixa.executarEmTransacao).not.toHaveBeenCalled()
    expect(repositorioDeRequisicoesWms.produtoDaEmpresa).not.toHaveBeenCalled()
  })

  it('sem quantidade não chama o repositório', async () => {
    await expect(
      servicoDeVendasCaixa.confirmarPagamento('c1', 'u1', {
        clienteNome: 'Maria',
        itens: [{ produtoId: PRODUTO, quantidade: 0 }],
      })
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(repositorioDeVendasCaixa.executarEmTransacao).not.toHaveBeenCalled()
  })

  it('produto de outra empresa responde 400', async () => {
    vi.mocked(repositorioDeRequisicoesWms.produtoDaEmpresa).mockResolvedValue(null)
    await expect(
      servicoDeVendasCaixa.confirmarPagamento('c1', 'u1', {
        clienteNome: 'Maria',
        itens: [{ produtoId: PRODUTO, quantidade: 2 }],
      })
    ).rejects.toMatchObject({ statusCode: 400, message: 'Produto não encontrado' })
    expect(repositorioDeVendasCaixa.executarEmTransacao).not.toHaveBeenCalled()
  })
})
