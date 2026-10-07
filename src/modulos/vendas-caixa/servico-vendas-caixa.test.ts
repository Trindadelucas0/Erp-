import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-vendas-caixa.js', () => ({
  repositorioDeVendasCaixa: {
    listarPagas: vi.fn(),
    listarChamados: vi.fn(),
    obterPorId: vi.fn(),
    executarEmTransacao: vi.fn(),
    proximoNumero: vi.fn(),
  },
}))

vi.mock('../requisicoes-wms/repositorio-requisicoes-wms.js', () => ({
  repositorioDeRequisicoesWms: {
    produtoDaEmpresa: vi.fn(),
  },
}))

vi.mock('./gerar-os-separacao-venda.js', async (importOriginal) => {
  const atual = await importOriginal<typeof import('./gerar-os-separacao-venda.js')>()
  return {
    ...atual,
    gerarOsSeparacaoDaVenda: vi.fn(),
  }
})

import { repositorioDeRequisicoesWms } from '../requisicoes-wms/repositorio-requisicoes-wms.js'
import { gerarOsSeparacaoDaVenda } from './gerar-os-separacao-venda.js'
import { MSG_FORMA_ORIGEM_INVALIDA } from './esquema-vendas-caixa.js'
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
        formaPagamento: 'dinheiro',
        origem: 'caixa',
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
        formaPagamento: 'dinheiro',
        origem: 'caixa',
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
        formaPagamento: 'dinheiro',
        origem: 'caixa',
      })
    ).rejects.toMatchObject({ statusCode: 400, message: 'Produto não encontrado' })
    expect(repositorioDeVendasCaixa.executarEmTransacao).not.toHaveBeenCalled()
  })

  it('totem com dinheiro responde 400 antes do repositório', async () => {
    await expect(
      servicoDeVendasCaixa.confirmarPagamento('c1', 'u1', {
        clienteNome: 'Maria',
        itens: [{ produtoId: PRODUTO, quantidade: 1 }],
        formaPagamento: 'dinheiro',
        origem: 'totem',
      })
    ).rejects.toMatchObject({ statusCode: 400, message: MSG_FORMA_ORIGEM_INVALIDA })
    expect(repositorioDeVendasCaixa.executarEmTransacao).not.toHaveBeenCalled()
    expect(repositorioDeRequisicoesWms.produtoDaEmpresa).not.toHaveBeenCalled()
  })

  it('caixa com pix responde 400 antes do repositório', async () => {
    await expect(
      servicoDeVendasCaixa.confirmarPagamento('c1', 'u1', {
        clienteNome: 'Maria',
        itens: [{ produtoId: PRODUTO, quantidade: 1 }],
        formaPagamento: 'pix',
        origem: 'caixa',
      })
    ).rejects.toMatchObject({ statusCode: 400, message: MSG_FORMA_ORIGEM_INVALIDA })
    expect(repositorioDeVendasCaixa.executarEmTransacao).not.toHaveBeenCalled()
  })

  it('chamar atendente não gera Separação', async () => {
    vi.mocked(repositorioDeRequisicoesWms.produtoDaEmpresa).mockResolvedValue({
      id: PRODUTO,
    } as never)
    vi.mocked(repositorioDeVendasCaixa.executarEmTransacao).mockImplementation(async (fn) =>
      fn({
        vendaCaixa: {
          create: vi.fn().mockResolvedValue({
            id: 'v1',
            numero: 7,
            clienteNome: 'Maria',
            status: 'chamado_atendente',
            formaPagamento: null,
          }),
        },
      } as never)
    )
    vi.mocked(repositorioDeVendasCaixa.proximoNumero).mockResolvedValue(7)

    const venda = await servicoDeVendasCaixa.chamarAtendente('c1', {
      clienteNome: 'Maria',
      itens: [{ produtoId: PRODUTO, quantidade: 1 }],
    })

    expect(venda.status).toBe('chamado_atendente')
    expect(venda.separacoes).toEqual([])
    expect(gerarOsSeparacaoDaVenda).not.toHaveBeenCalled()
  })

  it('confirmar chamado gera Separação uma vez e segundo confirma 409', async () => {
    vi.mocked(repositorioDeVendasCaixa.obterPorId).mockResolvedValue({
      id: 'v1',
      numero: 7,
      clienteNome: 'Maria',
      status: 'chamado_atendente',
      formaPagamento: null,
      itens: [{ produtoId: PRODUTO, quantidade: 2 }],
    } as never)
    vi.mocked(gerarOsSeparacaoDaVenda).mockResolvedValue([{ id: 'r1', numero: 11, produtoId: PRODUTO }])
    vi.mocked(repositorioDeVendasCaixa.executarEmTransacao).mockImplementation(async (fn) =>
      fn({
        vendaCaixa: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      } as never)
    )

    const primeira = await servicoDeVendasCaixa.confirmarChamado('c1', 'u1', 'v1', {
      formaPagamento: 'dinheiro',
    })
    expect(primeira.separacoes).toEqual([11])
    expect(gerarOsSeparacaoDaVenda).toHaveBeenCalledTimes(1)

    vi.mocked(repositorioDeVendasCaixa.obterPorId).mockResolvedValue({
      id: 'v1',
      numero: 7,
      clienteNome: 'Maria',
      status: 'paga',
      formaPagamento: 'dinheiro',
      itens: [{ produtoId: PRODUTO, quantidade: 2 }],
    } as never)

    await expect(
      servicoDeVendasCaixa.confirmarChamado('c1', 'u1', 'v1', { formaPagamento: 'dinheiro' })
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})
