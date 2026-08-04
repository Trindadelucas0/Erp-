import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-entrada-notas.js', () => ({
  repositorioEntradaNotas: {
    buscarNotaCompleta: vi.fn(),
    buscarNotaPorId: vi.fn(),
    atualizarNota: vi.fn(),
    criarTratativa: vi.fn(),
    listarTratativas: vi.fn(),
    listarPedidosAbertosFornecedor: vi.fn().mockResolvedValue([]),
    mapaCodigoOriginalPorProduto: vi.fn().mockResolvedValue(new Map()),
  },
}))

vi.mock('../focus-nfe/repositorio-focus-nfe.js', () => ({
  repositorioFocusNfe: {
    buscarConfigPorEmpresa: vi.fn().mockResolvedValue({
      apiToken: 'token',
      homologacao: true,
    }),
    upsertNfeRecebida: vi.fn(),
    atualizarDanfe: vi.fn(),
  },
}))

vi.mock('../focus-nfe/cliente-focus-nfe.js', () => ({
  clienteFocusNfe: {
    manifestar: vi.fn().mockResolvedValue(undefined),
    baixarXml: vi.fn(),
  },
}))

vi.mock('../autenticacao/servico-autenticacao.js', () => ({
  servicoDeAutenticacao: {
    verificarSenhaDoUsuario: vi.fn(),
  },
}))

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {},
}))

import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import { clienteFocusNfe } from '../focus-nfe/cliente-focus-nfe.js'
import { servicoDeAutenticacao } from '../autenticacao/servico-autenticacao.js'
import { servicoEntradaNotas } from './servico-pipeline-entrada.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

function notaBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    companyId: 'c1',
    chaveNfe: '35260100000000000000550010000000011123456789',
    statusEntrada: 'em_analise',
    tipoDocumento: 'nfe55',
    itens: [],
    tratativas: [],
    vinculosComoNfe: [],
    vinculosComoCte: [],
    despesasEntrada: [],
    fornecedorPessoa: null,
    ...overrides,
  }
}

function detalheMock(overrides: Record<string, unknown> = {}) {
  return {
    ...notaBase(overrides),
    valorTotal: null,
    dataEmissao: null,
    nomeEmitente: 'Forn',
    documentoEmitente: '123',
    origem: 'focus',
    etapaAtual: 'fiscal',
    nfeCompleta: true,
    criticasLiberadas: false,
    observacaoContato: null,
    pedidoCompraId: null,
    origemLancamento: null,
    prazoPagamentoXml: null,
    prazoPagamentoTexto: null,
    modFrete: null,
    chaveNfeReferenciada: null,
    analiseJson: null,
    manifestacaoDestinatario: null,
    problemaDesfecho: null,
    problemaMarcadoEm: null,
    problemaResolvidoEm: null,
  }
}

describe('entrada-notas com problemas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockImplementation(async () =>
      detalheMock({
        statusEntrada: (
          await vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mock.results.at(-1)?.value
        )?.statusEntrada ?? 'com_problema',
      }) as never
    )
  })

  it('marcarProblema move nota para com_problema', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockResolvedValue(
      notaBase({ statusEntrada: 'em_analise' }) as never
    )
    vi.mocked(repositorioEntradaNotas.atualizarNota).mockResolvedValue({} as never)
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      detalheMock({ statusEntrada: 'com_problema' }) as never
    )

    const r = await servicoEntradaNotas.marcarProblema('c1', 'nota-1')
    expect(repositorioEntradaNotas.atualizarNota).toHaveBeenCalledWith(
      'nota-1',
      expect.objectContaining({ statusEntrada: 'com_problema' })
    )
    expect(r.nota.statusEntrada).toBe('com_problema')
  })

  it('resolverProblema com solucao sai do fluxo', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockResolvedValue(
      notaBase({ statusEntrada: 'com_problema' }) as never
    )
    vi.mocked(repositorioEntradaNotas.atualizarNota).mockResolvedValue({} as never)
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      detalheMock({
        statusEntrada: 'problema_resolvido',
        problemaDesfecho: 'solucao',
      }) as never
    )

    const r = await servicoEntradaNotas.resolverProblema('c1', 'nota-1', 'solucao')
    expect(repositorioEntradaNotas.atualizarNota).toHaveBeenCalledWith(
      'nota-1',
      expect.objectContaining({
        statusEntrada: 'problema_resolvido',
        problemaDesfecho: 'solucao',
      })
    )
    expect(r.nota.statusEntrada).toBe('problema_resolvido')
  })

  it('desconhecer exige senha válida e vai para cancelada', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockResolvedValue(
      notaBase({ statusEntrada: 'com_problema' }) as never
    )
    vi.mocked(servicoDeAutenticacao.verificarSenhaDoUsuario).mockResolvedValue(true)
    vi.mocked(repositorioEntradaNotas.atualizarNota).mockResolvedValue({} as never)
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      detalheMock({
        statusEntrada: 'cancelada',
        manifestacaoDestinatario: 'desconhecimento_da_operacao',
        problemaDesfecho: 'desconhecimento',
      }) as never
    )

    await expect(
      servicoEntradaNotas.manifestar('c1', 'nota-1', 'desconhecimento', undefined, 'u1', '')
    ).rejects.toBeInstanceOf(ErroDaAplicacao)

    await servicoEntradaNotas.manifestar(
      'c1',
      'nota-1',
      'desconhecimento',
      undefined,
      'u1',
      'senha-ok'
    )

    expect(clienteFocusNfe.manifestar).toHaveBeenCalledWith(
      'token',
      true,
      expect.any(String),
      'desconhecimento_da_operacao',
      undefined
    )
    expect(repositorioEntradaNotas.atualizarNota).toHaveBeenCalledWith(
      'nota-1',
      expect.objectContaining({
        statusEntrada: 'cancelada',
        problemaDesfecho: 'desconhecimento',
      })
    )
  })
})
