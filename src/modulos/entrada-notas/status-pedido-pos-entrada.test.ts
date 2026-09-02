import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-entrada-notas.js', () => ({
  repositorioEntradaNotas: {
    buscarNotaCompleta: vi.fn(),
    buscarNotaPorId: vi.fn(),
    contarItens: vi.fn(),
    substituirItensDoXml: vi.fn(),
    backfillUnidadeItensDoXml: vi.fn(),
    atualizarNota: vi.fn(),
    atualizarItem: vi.fn(),
    buscarFornecedorPorCnpj: vi.fn(),
    buscarFlagsFornecedorEntrada: vi.fn().mockResolvedValue(null),
    buscarPedidoComItens: vi.fn(),
    somarConsolidadoPorProduto: vi.fn(),
    atualizarStatusPedidoCompra: vi.fn(),
    mapaSugestaoCfopEntradaPorCodigo: vi.fn().mockResolvedValue(new Map()),
    mapaCodigoOriginalPorProduto: vi.fn().mockResolvedValue(new Map()),
    listarPedidosAbertosFornecedor: vi.fn().mockResolvedValue([]),
    buscarUltimoPrecoConsolidadoPorProduto: vi.fn().mockResolvedValue(new Map()),
  },
}))

vi.mock('../contagens/repositorio-contagens.js', () => ({
  repositorioContagens: {
    buscarSessaoFinalizadaDaNota: vi.fn().mockResolvedValue({
      id: 'sessao-1',
      baixadaEm: new Date('2026-08-19'),
      notas: [{ nfeRecebidaId: 'nota-1' }],
    }),
    marcarSessaoBaixada: vi.fn(),
    reabrirSessaoAposBaixa: vi.fn(),
    listarNomesUnidades: vi.fn().mockResolvedValue(new Map()),
  },
}))

vi.mock('../autenticacao/servico-autenticacao.js', () => ({
  servicoDeAutenticacao: {
    verificarSenhaDoUsuario: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('../estoque/servico-estoque.js', () => ({
  servicoDeEstoque: {
    obterResumoEntradaNotaFiscal: vi.fn(),
    aplicarEntradaNotaFiscal: vi.fn().mockResolvedValue({
      movimentou: true,
      itensProcessados: 1,
      itensIgnorados: 0,
      movimentosGravados: 1,
      produtos: [],
    }),
    registrarMovimentoEstoque: vi.fn(),
  },
}))

vi.mock('../contas-a-pagar/gerar-titulos-entrada.js', () => ({
  gerarTitulosContasPagarDaEntrada: vi.fn().mockResolvedValue(null),
}))

vi.mock('../fornecedores/vinculos-fornecedor.js', () => ({
  obterPessoaIdsRedePorPessoaId: vi.fn(async (pessoaId: string) => [pessoaId]),
}))

vi.mock('./analise-cadastro/analisar-cadastro.js', () => ({
  analisarCadastro: vi.fn(),
}))

vi.mock('./analise-fiscal/analisar-fiscal-itens.js', () => ({
  analisarFiscalItens: vi.fn(),
}))

vi.mock('../focus-nfe/repositorio-focus-nfe.js', () => ({
  repositorioFocusNfe: {
    buscarConfigPorEmpresa: vi.fn().mockResolvedValue(null),
    buscarEmpresaCnpj: vi.fn().mockResolvedValue(null),
  },
}))

vi.mock('../focus-nfe/cliente-focus-nfe.js', () => ({
  clienteFocusNfe: {},
}))

vi.mock('./servico-vinculo-cte.js', () => ({
  servicoVinculoCte: {
    tentarVincularCteAutomatico: vi.fn(),
  },
}))

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    produto: { findFirst: vi.fn() },
    despesaEntradaDocumento: { upsert: vi.fn() },
    contaPagar: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import { analisarCadastro } from './analise-cadastro/analisar-cadastro.js'
import { analisarFiscalItens } from './analise-fiscal/analisar-fiscal-itens.js'
import { servicoEntradaNotas } from './servico-pipeline-entrada.js'

function itemComProduto(produtoId: string, quantidade: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `item-${produtoId}`,
    nItem: 1,
    produtoId,
    quantidade,
    valorUnitario: 10,
    descricao: 'Item',
    cfop: '5102',
    cfopEntradaId: 'cfop-ent',
    criticaFiscal: false,
    criticaNegociacao: false,
    vinculoModo: 'barras',
    produto: {
      nomeVenda: `Produto ${produtoId}`,
      ncm: '123',
      codigoOrigem: '0',
      sku: 'SKU',
      codigoBarras: null,
      marca: null,
      unidade: 'UN',
      pesoKg: null,
      controlaEstoque: true,
      fornecedores: [],
    },
    ...overrides,
  }
}

/** Nota "pronta" (pipeline já liberado, contagem OK) — usada nos testes via lancar(). */
function notaPronta(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    companyId: 'c1',
    chaveNfe: '4'.repeat(44),
    statusEntrada: 'entrada_contagem_ok',
    tipoDocumento: 'nfe55',
    modFrete: null,
    fornecedorPessoaId: 'pessoa-a',
    pedidoCompraId: 'pedido-1',
    criticasLiberadas: false,
    analiseJson: null,
    finalidadeEntrada: 'revenda',
    fornecedorPessoa: { papeis: [] },
    itens: [itemComProduto('prod-a', 10), itemComProduto('prod-b', 3)],
    tratativas: [],
    vinculosComoNfe: [],
    vinculosComoCte: [],
    despesasEntrada: [],
    ...overrides,
  }
}

const xmlComDet = `<NFe><infNFe><det nItem="1"><prod><cProd>1</cProd></prod></det></infNFe></NFe>`

/** Nota "em análise" com XML — usada no teste via analisarNota() (pipeline completo). */
function notaEmAnalise(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    companyId: 'c1',
    chaveNfe: '5'.repeat(44),
    tipoDocumento: 'nfe55',
    statusEntrada: 'em_analise',
    etapaAtual: 'negociacao',
    criticasLiberadas: false,
    pedidoCompraId: 'pedido-1',
    fornecedorPessoaId: 'pessoa-a',
    documentoEmitente: '123',
    prazoPagamentoXml: '30 dias',
    prazoPagamentoTexto: null,
    modFrete: '0',
    xmlConteudo: xmlComDet,
    nfeCompleta: true,
    analiseJson: null,
    itens: [itemComProduto('prod-b', 4)],
    finalidadeEntrada: 'revenda',
    fornecedorPessoa: {
      id: 'pessoa-a',
      nome: 'Fornecedor A',
      cnpj: '111',
      nomeFantasia: null,
      papeis: [
        {
          dadosFornecedor: {
            tipoRevenda: true,
            tipoConsumo: false,
            tipoPrestadorServico: false,
            exigirItensEntrada: false,
            permitirVinculoManual: false,
            regraRateioFrete: null,
          },
        },
      ],
    },
    vinculosComoNfe: [],
    vinculosComoCte: [],
    despesasEntrada: [],
    ...overrides,
  }
}

function ligarRepositorioFake(estadoInicial: ReturnType<typeof notaEmAnalise>) {
  let notaEstado = { ...estadoInicial }

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
  vi.mocked(repositorioEntradaNotas.atualizarItem).mockResolvedValue(undefined as never)
  vi.mocked(repositorioEntradaNotas.contarItens).mockResolvedValue(1)
  vi.mocked(repositorioEntradaNotas.backfillUnidadeItensDoXml).mockResolvedValue(0 as never)

  return { getEstado: () => notaEstado }
}

describe('Status do Pedido de Compra após consolidação da Entrada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioEntradaNotas.atualizarNota).mockResolvedValue({} as never)
    vi.mocked(repositorioEntradaNotas.atualizarItem).mockResolvedValue(undefined as never)
  })

  it('pedido com itens parcialmente entregues vira "parcial" (Entregue parcialmente)', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(notaPronta() as never)
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'pedido-1',
      status: 'enviado',
      itens: [
        { produtoId: 'prod-a', quantidade: 10 },
        { produtoId: 'prod-b', quantidade: 5 },
      ],
    } as never)
    // Após a NF virar entrada_consolidada, a soma já reflete o que essa NF trouxe.
    vi.mocked(repositorioEntradaNotas.somarConsolidadoPorProduto).mockResolvedValue(
      new Map([
        ['prod-a', 10],
        ['prod-b', 3],
      ])
    )

    await servicoEntradaNotas.lancar('c1', 'nota-1', 'user-1', 'consolidar', 'senha-correta')

    expect(repositorioEntradaNotas.atualizarStatusPedidoCompra).toHaveBeenCalledWith(
      'pedido-1',
      'parcial'
    )
  })

  it('pedido com todos os itens completos vira "recebido" (Concluído)', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaPronta({ statusEntrada: 'entrada_contagem_ok' }) as never
    )
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'pedido-1',
      status: 'parcial',
      itens: [
        { produtoId: 'prod-a', quantidade: 10 },
        { produtoId: 'prod-b', quantidade: 5 },
      ],
    } as never)
    // 2ª NF completa o item B — soma total já inclui as duas entradas.
    vi.mocked(repositorioEntradaNotas.somarConsolidadoPorProduto).mockResolvedValue(
      new Map([
        ['prod-a', 10],
        ['prod-b', 5],
      ])
    )

    await servicoEntradaNotas.lancar('c1', 'nota-1', 'user-1', 'consolidar', 'senha-correta')

    expect(repositorioEntradaNotas.atualizarStatusPedidoCompra).toHaveBeenCalledWith(
      'pedido-1',
      'recebido'
    )
  })

  it('não altera status quando a nota não está vinculada a pedido', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaPronta({ pedidoCompraId: null }) as never
    )

    await servicoEntradaNotas.lancar('c1', 'nota-1', 'user-1', 'consolidar', 'senha-correta')

    expect(repositorioEntradaNotas.buscarPedidoComItens).not.toHaveBeenCalled()
    expect(repositorioEntradaNotas.atualizarStatusPedidoCompra).not.toHaveBeenCalled()
  })

  it('não sobrescreve pedido cancelado/rascunho', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(notaPronta() as never)
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'pedido-1',
      status: 'cancelado',
      itens: [{ produtoId: 'prod-a', quantidade: 10 }],
    } as never)

    await servicoEntradaNotas.lancar('c1', 'nota-1', 'user-1', 'consolidar', 'senha-correta')

    expect(repositorioEntradaNotas.somarConsolidadoPorProduto).not.toHaveBeenCalled()
    expect(repositorioEntradaNotas.atualizarStatusPedidoCompra).not.toHaveBeenCalled()
  })

  it('Negociação bloqueia quando a NF traz, para um item, quantidade acima do saldo pendente do pedido', async () => {
    vi.mocked(analisarCadastro).mockResolvedValue({
      resultado: { status: 'ok', avisos: [], bloqueios: [] },
      itensAtualizados: [],
      fornecedorPessoaId: 'pessoa-a',
    } as never)
    vi.mocked(analisarFiscalItens).mockReturnValue({
      resultado: { status: 'ok', avisos: [], bloqueios: [] },
      itensCritica: [],
    })

    const fake = ligarRepositorioFake(notaEmAnalise())
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'pedido-1',
      numero: 42,
      status: 'parcial',
      condicaoPagamento: '30',
      prazosPagamento: null,
      itens: [
        {
          produtoId: 'prod-b',
          quantidade: 5,
          precoUnitario: 10,
          produto: { nomeVenda: 'Produto B' },
        },
      ],
      fornecedor: { id: 'pessoa-a', nome: 'Fornecedor A' },
    } as never)
    // 1ª NF já consolidou 3 de 5 — saldo pendente é 2. Esta NF traz 4 (acima do pendente).
    vi.mocked(repositorioEntradaNotas.somarConsolidadoPorProduto).mockResolvedValue(
      new Map([['prod-b', 3]])
    )

    const detalhe = await servicoEntradaNotas.analisarNota('c1', 'nota-1', {
      importarFocusSeAusente: false,
    })

    const analiseJson = fake.getEstado().analiseJson as {
      negociacao?: { bloqueios?: string[]; detalhes?: { achados?: Array<{ categoria: string; severidade: string }> } }
    } | null
    expect(analiseJson?.negociacao?.bloqueios?.length ?? 0).toBeGreaterThan(0)
    expect(
      analiseJson?.negociacao?.detalhes?.achados?.some(
        (a) => a.categoria === 'quantidade' && a.severidade === 'bloqueio'
      )
    ).toBe(true)
    expect(detalhe.nota.statusEntrada).toBe('em_analise')
  })
})
