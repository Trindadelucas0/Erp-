import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-entrada-notas.js', () => ({
  repositorioEntradaNotas: {
    buscarNotaCompleta: vi.fn(),
    atualizarNota: vi.fn(),
    buscarNotaPorId: vi.fn(),
  },
}))

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    planoFinanceiro: {
      findFirst: vi.fn().mockResolvedValue({ id: 'plano-1' }),
    },
    contaPagar: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('../contagens/repositorio-contagens.js', () => ({
  repositorioContagens: {
    buscarSessaoFinalizadaDaNota: vi.fn().mockResolvedValue(null),
    mapaBaixadaPorNota: vi.fn().mockResolvedValue(new Map()),
  },
}))

vi.mock('../contas-a-pagar/resolver-plano-financeiro-entrada.js', () => ({
  resolverPlanoFinanceiroEntrada: vi.fn().mockResolvedValue(null),
}))

vi.mock('../contas-a-pagar/resolver-parcelas-recorrencia.js', () => ({
  resolverParcelasRecorrencia: vi.fn(),
}))

import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import { servicoEntradaNotas } from './servico-pipeline-entrada.js'
import { podeConsolidarEstoque } from './status-entrada-contagem.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

function notaNfsePronta(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nota-nfse',
    companyId: 'c1',
    chaveNfe: '6'.repeat(44),
    tipoDocumento: 'nfse',
    statusEntrada: 'pronta_para_consolidar',
    etapaAtual: 'lancamento',
    pedidoCompraId: null,
    fornecedorPessoaId: 'pessoa-a',
    valorTotal: 1000,
    planoFinanceiroId: null,
    parcelasFinanceiras: null,
    xmlConteudo: null,
    itens: [],
    vinculosComoNfe: [],
    vinculosComoCte: [],
    despesasEntrada: [],
    fornecedorPessoa: { papeis: [] },
    ...overrides,
  }
}

describe('salvarFinanceiroDocumental', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejeita parcela sem data de vencimento (§7.4)', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaNfsePronta() as never
    )

    await expect(
      servicoEntradaNotas.salvarFinanceiroDocumental('c1', 'nota-nfse', {
        planoFinanceiroId: 'plano-1',
        parcelas: [{ numeroDocumento: null, vencimento: '', valor: 1000 }],
      })
    ).rejects.toThrow(ErroDaAplicacao)

    expect(repositorioEntradaNotas.atualizarNota).not.toHaveBeenCalled()
  })
})

describe('NFS-e sem pedido — consolidar documental', () => {
  it('permite consolidar em pronta_para_consolidar sem exigir contagem física', () => {
    expect(
      podeConsolidarEstoque('pronta_para_consolidar', { exigeContagemFisica: false })
    ).toBe(true)
  })
})
