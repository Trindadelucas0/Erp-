import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-entrada-notas.js', () => ({
  repositorioEntradaNotas: {
    buscarPedidoComItens: vi.fn(),
  },
}))

vi.mock('../contas-a-pagar/resolver-plano-financeiro-entrada.js', () => ({
  resolverPlanoFinanceiroEntrada: vi.fn().mockResolvedValue(null),
}))

vi.mock('../contas-a-pagar/resolver-parcelas-recorrencia.js', () => ({
  resolverParcelasRecorrencia: vi.fn(),
}))

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    planoFinanceiro: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}))

import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import {
  montarPreviaFinanceiraDocumental,
  montarResumoPedidoCompraDocumental,
} from './montar-dossie-documental.js'

describe('montarResumoPedidoCompraDocumental', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sem pedido vinculado retorna estado explícito não vinculado', async () => {
    const resumo = await montarResumoPedidoCompraDocumental('c1', {
      pedidoCompraId: null,
      valorTotal: 1500,
    })

    expect(resumo.vinculado).toBe(false)
    expect(resumo.semPedidoInformado).toBe(true)
    expect(resumo.linhas).toEqual([])
    expect(repositorioEntradaNotas.buscarPedidoComItens).not.toHaveBeenCalled()
  })

  it('com pedido compara valor total da NFS-e', async () => {
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'ped-1',
      numero: 42,
      itens: [
        {
          quantidade: 1,
          precoUnitario: 1500,
          produto: { nomeVenda: 'Serviço mensal' },
        },
      ],
    } as never)

    const resumo = await montarResumoPedidoCompraDocumental('c1', {
      pedidoCompraId: 'ped-1',
      valorTotal: 1500,
    })

    expect(resumo.vinculado).toBe(true)
    expect(resumo.semPedidoInformado).toBe(false)
    expect(resumo.pedido).toEqual({ id: 'ped-1', numero: 42 })
    expect(resumo.linhas).toHaveLength(1)
    expect(resumo.linhas[0]?.situacao).toBe('ok')
  })
})

describe('montarPreviaFinanceiraDocumental', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sem vencimento gravado marca prévia incompleta', async () => {
    const previa = await montarPreviaFinanceiraDocumental('c1', {
      id: 'nota-1',
      tipoDocumento: 'nfse',
      valorTotal: 500,
      fornecedorPessoaId: 'p1',
      cfopEntradaId: 'cfop-1',
      planoFinanceiroId: 'plano-1',
      parcelasFinanceiras: [{ numeroDocumento: null, vencimento: null, valor: 500 }],
      xmlConteudo: null,
      prazoPagamentoXml: null,
      prazoPagamentoTexto: null,
      dataEmissao: new Date('2026-01-15'),
      recorrenciaFinanceiraId: null,
      planoFinanceiro: { id: 'plano-1', codigo: '4.1', nome: 'Serviços' },
    })

    expect(previa.completo).toBe(false)
    expect(previa.bloqueios.some((b) => /vencimento/i.test(b))).toBe(true)
  })
})
