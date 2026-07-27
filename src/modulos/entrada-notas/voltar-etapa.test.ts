import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-entrada-notas.js', () => ({
  repositorioEntradaNotas: {
    buscarNotaCompleta: vi.fn(),
    buscarNotaPorId: vi.fn(),
    contarItens: vi.fn(),
    substituirItensDoXml: vi.fn(),
    atualizarNota: vi.fn(),
    atualizarItem: vi.fn(),
    buscarFornecedorPorCnpj: vi.fn(),
    buscarProdutoPorGtin: vi.fn(),
    buscarProdutoPorCodigoOriginal: vi.fn(),
    listarPedidosAbertosFornecedor: vi.fn(),
    buscarPedidoComItens: vi.fn(),
    gravarCodigoOriginalVinculo: vi.fn(),
    mapaCodigoOriginalPorProduto: vi.fn(),
    atualizarFiscalProduto: vi.fn(),
    listarNotasPendentesPorDocumento: vi.fn(),
    listarNotasPendentesSemFornecedor: vi.fn(),
  },
}))

vi.mock('./analise-cadastro/analisar-cadastro.js', () => ({
  analisarCadastro: vi.fn(),
}))

vi.mock('./analise-fiscal/analisar-fiscal-itens.js', () => ({
  analisarFiscalItens: vi.fn(),
}))

vi.mock('./analise-negociacao/analisar-negociacao.js', () => ({
  analisarNegociacao: vi.fn(),
}))

vi.mock('../focus-nfe/repositorio-focus-nfe.js', () => ({
  repositorioFocusNfe: { buscarConfigPorEmpresa: vi.fn().mockResolvedValue(null) },
}))

vi.mock('../focus-nfe/cliente-focus-nfe.js', () => ({
  clienteFocusNfe: { manifestar: vi.fn() },
}))

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    produto: { findFirst: vi.fn() },
    despesaEntradaDocumento: { upsert: vi.fn() },
  },
}))

import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import { analisarCadastro } from './analise-cadastro/analisar-cadastro.js'
import { analisarFiscalItens } from './analise-fiscal/analisar-fiscal-itens.js'
import { analisarNegociacao } from './analise-negociacao/analisar-negociacao.js'
import { servicoEntradaNotas } from './servico-pipeline-entrada.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

function buildNotaFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    companyId: 'empresa-1',
    chaveNfe: '1'.repeat(44),
    tipoDocumento: 'nfe55',
    nomeEmitente: 'Fornecedor Teste',
    documentoEmitente: '11222333000181',
    valorTotal: 100,
    dataEmissao: null,
    statusEntrada: 'entrada_contagem',
    origem: 'xml',
    etapaAtual: 'lancamento',
    nfeCompleta: true,
    criticasLiberadas: true,
    observacaoContato: null,
    pedidoCompraId: null,
    origemLancamento: 'automatica',
    prazoPagamentoXml: null,
    prazoPagamentoTexto: null,
    modFrete: null,
    chaveNfeReferenciada: null,
    xmlConteudo: '<NFe></NFe>',
    fornecedorPessoaId: 'fornecedor-1',
    fornecedorPessoa: null,
    analiseJson: {
      versao: 1,
      atualizadoEm: new Date().toISOString(),
      cadastro: { status: 'ok', avisos: [], bloqueios: [] },
      fiscal: { status: 'ok', avisos: [], bloqueios: [] },
      negociacao: { status: 'ok', avisos: [], bloqueios: [] },
      frete: { status: 'ok', avisos: [], bloqueios: [] },
      autoLancado: true,
      motivoParada: null,
    },
    vinculosComoNfe: [],
    vinculosComoCte: [],
    despesasEntrada: [],
    itens: [
      {
        id: 'item-1',
        nItem: 1,
        descricao: 'Lâmpada Resvola',
        gtin: '7891234567890',
        codigoProduto: 'ABC',
        ncm: null,
        cfop: null,
        cst: null,
        origem: null,
        quantidade: 1,
        valorUnitario: 10,
        valorTotal: 10,
        pesoKg: null,
        custoFreteRateado: null,
        produtoId: 'produto-errado',
        vinculoModo: 'barras',
        criticaCadastro: false,
        criticaFiscal: false,
        criticaNegociacao: false,
        produto: null,
      },
    ],
    ...overrides,
  }
}

/** Fake repositório em memória: atualizarNota/atualizarItem mutam o mesmo estado devolvido pelas buscas. */
function ligarRepositorioFake(estadoInicial: ReturnType<typeof buildNotaFixture>) {
  let notaEstado = estadoInicial

  vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockImplementation(
    async () => JSON.parse(JSON.stringify(notaEstado)) as never
  )
  vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockImplementation(
    async () => JSON.parse(JSON.stringify(notaEstado)) as never
  )
  vi.mocked(repositorioEntradaNotas.atualizarNota).mockImplementation(async (_id, dados) => {
    notaEstado = { ...notaEstado, ...dados } as typeof notaEstado
    return JSON.parse(JSON.stringify(notaEstado)) as never
  })
  vi.mocked(repositorioEntradaNotas.atualizarItem).mockImplementation(async (id, dados) => {
    notaEstado = {
      ...notaEstado,
      itens: notaEstado.itens.map((item) => (item.id === id ? { ...item, ...dados } : item)),
    }
    return notaEstado.itens.find((item) => item.id === id) as never
  })
  vi.mocked(repositorioEntradaNotas.contarItens).mockResolvedValue(1)
  vi.mocked(repositorioEntradaNotas.listarPedidosAbertosFornecedor).mockResolvedValue([])
  vi.mocked(repositorioEntradaNotas.mapaCodigoOriginalPorProduto).mockResolvedValue(new Map())

  return {
    getEstado: () => notaEstado,
  }
}

describe('servicoEntradaNotas.voltarEtapa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(analisarCadastro).mockResolvedValue({
      resultado: { status: 'ok', avisos: [], bloqueios: [] },
      fornecedorPessoaId: 'fornecedor-1',
      itensAtualizados: [
        { id: 'item-1', produtoId: 'produto-errado', vinculoModo: 'barras', criticaCadastro: false },
      ],
    } as never)
  })

  it('reabre nota já lançada, limpa fiscal/negociação e para em cadastro sem rodar as etapas seguintes', async () => {
    ligarRepositorioFake(buildNotaFixture())

    const resultado = await servicoEntradaNotas.voltarEtapa(
      'empresa-1',
      'nota-1',
      'usuario-1',
      'cadastro'
    )

    const nota = resultado.nota as Record<string, unknown>
    expect(nota.statusEntrada).toBe('em_analise')
    expect(nota.origemLancamento).toBeNull()
    expect(nota.etapaAtual).toBe('cadastro')
    expect(nota.criticasLiberadas).toBe(false)

    const analise = nota.analise as Record<string, { status: string }>
    expect(analise.fiscal.status).toBe('pendente')
    expect(analise.negociacao.status).toBe('pendente')

    expect(analisarFiscalItens).not.toHaveBeenCalled()
    expect(analisarNegociacao).not.toHaveBeenCalled()
  })

  it('rejeita voltar etapa em nota cancelada', async () => {
    ligarRepositorioFake(buildNotaFixture({ statusEntrada: 'cancelada' }))

    await expect(
      servicoEntradaNotas.voltarEtapa('empresa-1', 'nota-1', 'usuario-1', 'cadastro')
    ).rejects.toBeInstanceOf(ErroDaAplicacao)
    expect(repositorioEntradaNotas.atualizarNota).not.toHaveBeenCalled()
  })

  it('rejeita etapaDestino que não é anterior à etapa atual', async () => {
    ligarRepositorioFake(
      buildNotaFixture({
        statusEntrada: 'em_analise',
        etapaAtual: 'cadastro',
        origemLancamento: null,
        analiseJson: {
          versao: 1,
          atualizadoEm: new Date().toISOString(),
          cadastro: { status: 'ok', avisos: [], bloqueios: [] },
          fiscal: { status: 'pendente', avisos: [], bloqueios: [] },
          negociacao: { status: 'pendente', avisos: [], bloqueios: [] },
          autoLancado: false,
          motivoParada: null,
        },
      })
    )

    await expect(
      servicoEntradaNotas.voltarEtapa('empresa-1', 'nota-1', 'usuario-1', 'fiscal')
    ).rejects.toMatchObject({ message: expect.stringContaining('não é anterior') })
    expect(repositorioEntradaNotas.atualizarNota).not.toHaveBeenCalled()
  })
})

describe('servicoEntradaNotas.desvincularItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('zera o vínculo do item, marca crítica de cadastro e reabre nota lançada', async () => {
    ligarRepositorioFake(buildNotaFixture())

    const resultado = await servicoEntradaNotas.desvincularItem('empresa-1', 'nota-1', 'item-1')

    const nota = resultado.nota as { statusEntrada: string; origemLancamento: string | null }
    expect(nota.statusEntrada).toBe('em_analise')
    expect(nota.origemLancamento).toBeNull()

    const item = (resultado.nota as { itens: Array<{ id: string; produtoId: string | null }> }).itens.find(
      (i) => i.id === 'item-1'
    )
    expect(item?.produtoId).toBeNull()

    const analise = (resultado.nota as { analise: { cadastro: { status: string }; motivoParada: string | null } })
      .analise
    expect(analise.cadastro.status).toBe('bloqueante')
    expect(analise.motivoParada).toBe('cadastro')
  })

  it('rejeita desvincular item em nota cancelada', async () => {
    ligarRepositorioFake(buildNotaFixture({ statusEntrada: 'cancelada' }))

    await expect(
      servicoEntradaNotas.desvincularItem('empresa-1', 'nota-1', 'item-1')
    ).rejects.toBeInstanceOf(ErroDaAplicacao)
    expect(repositorioEntradaNotas.atualizarItem).not.toHaveBeenCalled()
  })
})
