import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    nfeRecebida: { findFirst: vi.fn() },
    despesaEntradaDocumento: { findUnique: vi.fn() },
  },
}))

vi.mock('./repositorio-contas-a-pagar.js', () => ({
  ErroBaixa: class ErroBaixa extends Error {},
  repositorioDeContasAPagar: {
    buscarPorNfeOrigem: vi.fn(),
    criarDeEntrada: vi.fn(),
    substituirParcelasSemBaixa: vi.fn(),
  },
}))

vi.mock('./resolver-plano-financeiro-entrada.js', () => ({
  primeiroPlanoLiberadoFornecedor: vi.fn(),
  resolverPlanoFinanceiroEntrada: vi.fn(),
}))

vi.mock('./resolver-parcelas-recorrencia.js', () => ({
  resolverParcelasRecorrencia: vi.fn(),
}))

vi.mock('../focus-nfe/parser-xml-nfe.js', () => ({
  normalizarXmlNfe: (xml: string) => xml,
  extrairDuplicatasCobrancaDoXml: vi.fn(() => []),
  extrairCampoXml: vi.fn(() => null),
  montarParcelasContaPagarDaNfe: vi.fn(() => ({
    ok: false,
    mensagem: 'NF sem duplicatas/vencimento (cobr/dup)',
  })),
}))

import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  extrairDuplicatasCobrancaDoXml,
  montarParcelasContaPagarDaNfe,
} from '../focus-nfe/parser-xml-nfe.js'
import { repositorioDeContasAPagar } from './repositorio-contas-a-pagar.js'
import { resolverPlanoFinanceiroEntrada } from './resolver-plano-financeiro-entrada.js'
import { gerarTitulosContasPagarDaEntrada } from './gerar-titulos-entrada.js'

function contaFake(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cap-1',
    codigo: '451.001',
    origem: 'nfe',
    ...overrides,
  }
}

function notaBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    tipoDocumento: 'nfe55',
    finalidadeEntrada: null as string | null,
    xmlConteudo: '<nfe/>',
    valorTotal: 640,
    dataEmissao: new Date('2026-09-16'),
    fornecedorPessoaId: 'pessoa-a',
    chaveNfe: '3'.repeat(44),
    prazoPagamentoXml: null,
    prazoPagamentoTexto: null,
    recorrenciaFinanceiraId: null,
    cfopEntradaId: 'cfop-1',
    planoFinanceiroId: 'plano-1',
    parcelasFinanceiras: null as unknown,
    recorrenciaFinanceira: null,
    modFrete: null,
    vinculosComoNfe: [],
    ...overrides,
  }
}

describe('gerarTitulosContasPagarDaEntrada — documental / uso_consumo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolverPlanoFinanceiroEntrada).mockResolvedValue('plano-1')
    vi.mocked(repositorioDeContasAPagar.buscarPorNfeOrigem).mockResolvedValue(null)
    vi.mocked(repositorioDeContasAPagar.criarDeEntrada).mockResolvedValue({
      conta: contaFake() as never,
      criado: true,
    })
    vi.mocked(montarParcelasContaPagarDaNfe).mockReturnValue({
      ok: false,
      mensagem: 'NF sem duplicatas/vencimento (cobr/dup)',
    })
  })

  it('NFe uso_consumo com parcelasFinanceiras gera título sem cobr/dup do XML', async () => {
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValue(
      notaBase({
        finalidadeEntrada: 'uso_consumo',
        parcelasFinanceiras: [
          { numeroDocumento: null, vencimento: '2026-09-30', valor: 640 },
        ],
        xmlConteudo: '<nfe sem cobr/>',
      }) as never
    )

    const r = await gerarTitulosContasPagarDaEntrada('c1', 'nota-1')

    expect(r.gerados).toBe(1)
    expect(montarParcelasContaPagarDaNfe).not.toHaveBeenCalled()
    expect(repositorioDeContasAPagar.criarDeEntrada).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        origem: 'nfe',
        planoFinanceiroId: 'plano-1',
        observacao: expect.stringMatching(/uso e consumo/i),
        parcelas: [
          expect.objectContaining({
            valor: 640,
            vencimento: expect.any(Date),
          }),
        ],
      })
    )
  })

  it('NFe uso_consumo sem prévia e exigirVencimento true → 400 (não null)', async () => {
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValue(
      notaBase({
        finalidadeEntrada: 'uso_consumo',
        parcelasFinanceiras: null,
        xmlConteudo: null,
      }) as never
    )

    await expect(gerarTitulosContasPagarDaEntrada('c1', 'nota-1')).rejects.toBeInstanceOf(
      ErroDaAplicacao
    )
    expect(repositorioDeContasAPagar.criarDeEntrada).not.toHaveBeenCalled()
  })

  it('NFS-e com prévia gera título (regressão)', async () => {
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValue(
      notaBase({
        tipoDocumento: 'nfse',
        finalidadeEntrada: null,
        parcelasFinanceiras: [
          { numeroDocumento: null, vencimento: '2026-10-01', valor: 1000 },
        ],
        valorTotal: 1000,
      }) as never
    )

    const r = await gerarTitulosContasPagarDaEntrada('c1', 'nota-1')
    expect(r.gerados).toBe(1)
    expect(montarParcelasContaPagarDaNfe).not.toHaveBeenCalled()
    expect(repositorioDeContasAPagar.criarDeEntrada).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        observacao: expect.stringMatching(/NFS-e/i),
      })
    )
  })

  it('NFe 55 Revenda continua usando cobr/dup do XML', async () => {
    const venc = new Date('2026-09-20T00:00:00.000Z')
    vi.mocked(montarParcelasContaPagarDaNfe).mockReturnValue({
      ok: true,
      parcelas: [{ numeroDocumento: '1', vencimento: venc, valor: 640 }],
    })
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValue(
      notaBase({
        finalidadeEntrada: 'revenda',
        parcelasFinanceiras: [
          { numeroDocumento: null, vencimento: '2026-12-01', valor: 640 },
        ],
      }) as never
    )

    const r = await gerarTitulosContasPagarDaEntrada('c1', 'nota-1')
    expect(r.gerados).toBe(1)
    expect(montarParcelasContaPagarDaNfe).toHaveBeenCalled()
    expect(repositorioDeContasAPagar.criarDeEntrada).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        parcelas: [expect.objectContaining({ vencimento: venc, valor: 640 })],
      })
    )
  })

  it('idempotente: título existente não duplica', async () => {
    vi.mocked(repositorioDeContasAPagar.buscarPorNfeOrigem).mockResolvedValue(
      contaFake({
        status: 'aberto',
        valorTotal: 640,
        parcelas: [{ valor: 640, valorPago: 0, baixas: [] }],
      }) as never
    )
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValue(
      notaBase({
        finalidadeEntrada: 'uso_consumo',
        parcelasFinanceiras: [
          { numeroDocumento: null, vencimento: '2026-09-30', valor: 640 },
        ],
      }) as never
    )

    const r = await gerarTitulosContasPagarDaEntrada('c1', 'nota-1')
    expect(r.gerados).toBe(0)
    expect(repositorioDeContasAPagar.criarDeEntrada).not.toHaveBeenCalled()
    expect(repositorioDeContasAPagar.substituirParcelasSemBaixa).not.toHaveBeenCalled()
  })

  it('NFe Revenda: regrava 1 parcela=total quando XML tem N dups e sem baixa', async () => {
    const venc1 = new Date('2026-10-06T12:00:00.000Z')
    const venc2 = new Date('2026-10-20T12:00:00.000Z')
    const venc3 = new Date('2026-11-03T12:00:00.000Z')
    vi.mocked(repositorioDeContasAPagar.buscarPorNfeOrigem).mockResolvedValue(
      contaFake({
        status: 'aberto',
        valorTotal: 11277.11,
        parcelas: [{ valor: 11277.11, valorPago: 0, baixas: [] }],
      }) as never
    )
    vi.mocked(extrairDuplicatasCobrancaDoXml).mockReturnValue([
      { numeroDocumento: '001', vencimento: venc1, valor: 3759.79 },
      { numeroDocumento: '002', vencimento: venc2, valor: 3758.66 },
      { numeroDocumento: '003', vencimento: venc3, valor: 3758.66 },
    ])
    vi.mocked(montarParcelasContaPagarDaNfe).mockReturnValue({
      ok: true,
      parcelas: [
        { numeroDocumento: '001', vencimento: venc1, valor: 3759.79 },
        { numeroDocumento: '002', vencimento: venc2, valor: 3758.66 },
        { numeroDocumento: '003', vencimento: venc3, valor: 3758.66 },
      ],
    })
    vi.mocked(repositorioDeContasAPagar.substituirParcelasSemBaixa).mockResolvedValue(
      contaFake({ id: 'cap-1', codigo: '9' }) as never
    )
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValue(
      notaBase({
        finalidadeEntrada: 'revenda',
        valorTotal: 11277.11,
        xmlConteudo: '<nfe com cobr/>',
      }) as never
    )

    const r = await gerarTitulosContasPagarDaEntrada('c1', 'nota-1')
    expect(r.gerados).toBe(0)
    expect(repositorioDeContasAPagar.substituirParcelasSemBaixa).toHaveBeenCalledWith(
      'c1',
      'cap-1',
      expect.arrayContaining([
        expect.objectContaining({ numeroDocumento: '001', valor: 3759.79 }),
        expect.objectContaining({ numeroDocumento: '003', valor: 3758.66 }),
      ])
    )
    expect(repositorioDeContasAPagar.criarDeEntrada).not.toHaveBeenCalled()
  })

  it('NFe Revenda: regrava quando qtd/valores das parcelas ≠ cobr/dup (sem baixa)', async () => {
    const venc1 = new Date('2026-10-06T12:00:00.000Z')
    const venc2 = new Date('2026-10-20T12:00:00.000Z')
    vi.mocked(repositorioDeContasAPagar.buscarPorNfeOrigem).mockResolvedValue(
      contaFake({
        status: 'aberto',
        valorTotal: 100,
        parcelas: [
          {
            numeroDocumento: 'X',
            vencimento: '2026-09-01',
            valor: 100,
            valorPago: 0,
            baixas: [],
          },
        ],
      }) as never
    )
    vi.mocked(extrairDuplicatasCobrancaDoXml).mockReturnValue([
      { numeroDocumento: '001', vencimento: venc1, valor: 40 },
      { numeroDocumento: '002', vencimento: venc2, valor: 60 },
    ])
    vi.mocked(montarParcelasContaPagarDaNfe).mockReturnValue({
      ok: true,
      parcelas: [
        { numeroDocumento: '001', vencimento: venc1, valor: 40 },
        { numeroDocumento: '002', vencimento: venc2, valor: 60 },
      ],
    })
    vi.mocked(repositorioDeContasAPagar.substituirParcelasSemBaixa).mockResolvedValue(
      contaFake({ id: 'cap-1', codigo: '9' }) as never
    )
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValue(
      notaBase({
        finalidadeEntrada: 'revenda',
        valorTotal: 100,
        xmlConteudo: '<nfe/>',
      }) as never
    )

    await gerarTitulosContasPagarDaEntrada('c1', 'nota-1')
    expect(repositorioDeContasAPagar.substituirParcelasSemBaixa).toHaveBeenCalled()
  })

  it('não regrava parcelas se já houver baixa', async () => {
    vi.mocked(repositorioDeContasAPagar.buscarPorNfeOrigem).mockResolvedValue(
      contaFake({
        status: 'aberto',
        valorTotal: 11277.11,
        parcelas: [{ valor: 11277.11, valorPago: 100, baixas: [{ id: 'b1' }] }],
      }) as never
    )
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValue(
      notaBase({
        finalidadeEntrada: 'revenda',
        valorTotal: 11277.11,
        xmlConteudo: '<nfe/>',
      }) as never
    )

    const r = await gerarTitulosContasPagarDaEntrada('c1', 'nota-1')
    expect(r.gerados).toBe(0)
    expect(repositorioDeContasAPagar.substituirParcelasSemBaixa).not.toHaveBeenCalled()
  })
})
