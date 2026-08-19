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
    buscarTipoCompraPedido: vi.fn(),
    somarConsolidadoPorProduto: vi.fn().mockResolvedValue(new Map()),
    buscarUltimoPrecoConsolidadoPorProduto: vi.fn().mockResolvedValue(new Map()),
    atualizarStatusPedidoCompra: vi.fn(),
    mapaSugestaoCfopEntradaPorCodigo: vi.fn().mockResolvedValue(new Map()),
    mapaCodigoOriginalPorProduto: vi.fn().mockResolvedValue(new Map()),
    listarPedidosAbertosFornecedor: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../contagens/repositorio-contagens.js', () => ({
  repositorioContagens: {
    buscarSessaoFinalizadaDaNota: vi.fn().mockResolvedValue(null),
    marcarSessaoBaixada: vi.fn(),
    reabrirSessaoAposBaixa: vi.fn(),
    mapaBaixadaPorNota: vi.fn().mockResolvedValue(new Map()),
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
    aplicarEntradaNotaFiscal: vi.fn(),
    registrarMovimentoEstoque: vi.fn(),
  },
}))

vi.mock('../contas-a-pagar/gerar-titulos-entrada.js', () => ({
  gerarTitulosContasPagarDaEntrada: vi.fn().mockResolvedValue({ gerados: 0, contas: [] }),
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

vi.mock('./analise-negociacao/analisar-negociacao.js', () => ({
  analisarNegociacao: vi.fn(),
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
import { analisarNegociacao } from './analise-negociacao/analisar-negociacao.js'
import { servicoEntradaNotas } from './servico-pipeline-entrada.js'
import { gerarTitulosContasPagarDaEntrada } from '../contas-a-pagar/gerar-titulos-entrada.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

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

const xmlComDet = `<NFe><infNFe><det nItem="1"><prod><cProd>1</cProd></prod></det></infNFe></NFe>`

/** Nota "em análise" com XML, pronta para o auto-lançamento (via analisarNota()). */
function notaEmAnalise(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    companyId: 'c1',
    chaveNfe: '5'.repeat(44),
    tipoDocumento: 'nfe55',
    statusEntrada: 'em_analise',
    etapaAtual: 'negociacao',
    criticasLiberadas: false,
    pedidoCompraId: null,
    fornecedorPessoaId: 'pessoa-a',
    documentoEmitente: '123',
    prazoPagamentoXml: '30 dias',
    prazoPagamentoTexto: null,
    modFrete: '0',
    xmlConteudo: xmlComDet,
    nfeCompleta: true,
    analiseJson: null,
    itens: [itemComProduto('prod-b', 4)],
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

/** Nota documental (NFS-e) — sem itens de produto, liberação automática direto. */
function notaNfse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    companyId: 'c1',
    chaveNfe: '6'.repeat(44),
    tipoDocumento: 'nfse',
    statusEntrada: 'em_analise',
    etapaAtual: 'servico',
    criticasLiberadas: false,
    pedidoCompraId: null,
    fornecedorPessoaId: 'pessoa-a',
    documentoEmitente: '123',
    xmlConteudo: null,
    itens: [],
    vinculosComoNfe: [],
    vinculosComoCte: [],
    despesasEntrada: [],
    analiseJson: null,
    ...overrides,
  }
}

/** Nota já lançada — usada nos testes de liberarParaContagem() (sem passar pelo pipeline). */
function notaLancada(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    companyId: 'c1',
    chaveNfe: '7'.repeat(44),
    statusEntrada: 'aguardando_chegada',
    tipoDocumento: 'nfe55',
    modFrete: '0',
    fornecedorPessoaId: 'pessoa-a',
    pedidoCompraId: 'pedido-1',
    criticasLiberadas: false,
    analiseJson: null,
    xmlConteudo: xmlComDet,
    fornecedorPessoa: { papeis: [] },
    itens: [itemComProduto('prod-a', 10, { descricao: 'Produto prod-a' })],
    tratativas: [],
    vinculosComoNfe: [],
    vinculosComoCte: [],
    despesasEntrada: [],
    ...overrides,
  }
}

function ligarRepositorioFake(estadoInicial: Record<string, unknown>) {
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

/** Cadastro/fiscal/negociação sempre "ok" — só o destino pós-lançamento é o que se testa aqui. */
function ligarAnaliseSempreOk() {
  vi.mocked(analisarCadastro).mockResolvedValue({
    resultado: { status: 'ok', avisos: [], bloqueios: [] },
    itensAtualizados: [],
    fornecedorPessoaId: 'pessoa-a',
  } as never)
  vi.mocked(analisarFiscalItens).mockReturnValue({
    resultado: { status: 'ok', avisos: [], bloqueios: [] },
    itensCritica: [],
  } as never)
  vi.mocked(analisarNegociacao).mockReturnValue({
    resultado: { status: 'ok', avisos: [], bloqueios: [] },
    itensCritica: [],
  } as never)
}

describe('Status pós-lançamento — "Aguardando chegada" (revenda com pedido vinculado)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('NF de mercadoria com pedido tipoCompra="revenda" cai em aguardando_chegada ao lançar automaticamente', async () => {
    ligarAnaliseSempreOk()
    const fake = ligarRepositorioFake(notaEmAnalise({ pedidoCompraId: 'pedido-1' }))
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'pedido-1',
      numero: 42,
      status: 'enviado',
      tipoCompra: 'revenda',
      condicaoPagamento: '30',
      prazosPagamento: null,
      itens: [
        { produtoId: 'prod-b', quantidade: 10, precoUnitario: 10, produto: { nomeVenda: 'Produto B' } },
      ],
      fornecedor: { id: 'pessoa-a', nome: 'Fornecedor A' },
    } as never)

    const detalhe = await servicoEntradaNotas.analisarNota('c1', 'nota-1', {
      importarFocusSeAusente: false,
    })

    expect(fake.getEstado().statusEntrada).toBe('aguardando_chegada')
    expect(detalhe.nota.statusEntrada).toBe('aguardando_chegada')
  })

  it('NF de mercadoria com pedido tipoCompra="bonificacao" cai em entrada_contagem (sem mudança)', async () => {
    ligarAnaliseSempreOk()
    const fake = ligarRepositorioFake(notaEmAnalise({ pedidoCompraId: 'pedido-2' }))
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'pedido-2',
      numero: 43,
      status: 'enviado',
      tipoCompra: 'bonificacao',
      condicaoPagamento: '30',
      prazosPagamento: null,
      itens: [
        { produtoId: 'prod-b', quantidade: 10, precoUnitario: 10, produto: { nomeVenda: 'Produto B' } },
      ],
      fornecedor: { id: 'pessoa-a', nome: 'Fornecedor A' },
    } as never)

    const detalhe = await servicoEntradaNotas.analisarNota('c1', 'nota-1', {
      importarFocusSeAusente: false,
    })

    expect(fake.getEstado().statusEntrada).toBe('entrada_contagem')
    expect(detalhe.nota.statusEntrada).toBe('entrada_contagem')
    expect(repositorioEntradaNotas.buscarTipoCompraPedido).not.toHaveBeenCalled()
  })

  it('NF de mercadoria sem pedido vinculado cai em entrada_contagem (sem mudança)', async () => {
    ligarAnaliseSempreOk()
    const fake = ligarRepositorioFake(notaEmAnalise({ pedidoCompraId: null }))

    const detalhe = await servicoEntradaNotas.analisarNota('c1', 'nota-1', {
      importarFocusSeAusente: false,
    })

    expect(fake.getEstado().statusEntrada).toBe('entrada_contagem')
    expect(detalhe.nota.statusEntrada).toBe('entrada_contagem')
    expect(repositorioEntradaNotas.buscarPedidoComItens).not.toHaveBeenCalled()
    expect(repositorioEntradaNotas.buscarTipoCompraPedido).not.toHaveBeenCalled()
    expect(gerarTitulosContasPagarDaEntrada).not.toHaveBeenCalled()
  })

  it('NFS-e (documental) sempre lança direto em entrada_contagem — nunca aguardando_chegada', async () => {
    ligarAnaliseSempreOk()
    const fake = ligarRepositorioFake(notaNfse({ pedidoCompraId: 'pedido-1' }))
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'pedido-1',
      tipoCompra: 'revenda',
      itens: [],
    } as never)

    const detalhe = await servicoEntradaNotas.analisarNota('c1', 'nota-1', {
      importarFocusSeAusente: false,
    })

    expect(fake.getEstado().statusEntrada).toBe('entrada_contagem')
    expect(detalhe.nota.statusEntrada).toBe('entrada_contagem')
  })

  it('lancar() manual: revenda com pedido vinculado também cai em aguardando_chegada', async () => {
    const fake = ligarRepositorioFake(
      notaLancada({
        statusEntrada: 'em_analise',
        analiseJson: {
          versao: 1,
          atualizadoEm: new Date().toISOString(),
          cadastro: { status: 'ok', avisos: [], bloqueios: [] },
          fiscal: { status: 'ok', avisos: [], bloqueios: [] },
          negociacao: { status: 'ok', avisos: [], bloqueios: [] },
          autoLancado: false,
          motivoParada: null,
        },
      })
    )
    vi.mocked(repositorioEntradaNotas.buscarTipoCompraPedido).mockResolvedValue({
      tipoCompra: 'revenda',
    } as never)

    await servicoEntradaNotas.lancar('c1', 'nota-1', 'user-1', 'contagem')

    expect(fake.getEstado().statusEntrada).toBe('aguardando_chegada')
    expect(repositorioEntradaNotas.buscarTipoCompraPedido).toHaveBeenCalledWith('pedido-1')
    expect(gerarTitulosContasPagarDaEntrada).not.toHaveBeenCalled()
  })

  it('lancar() bloqueia relançar "contagem" quando a nota já está aguardando_chegada', async () => {
    ligarRepositorioFake(notaLancada({ statusEntrada: 'aguardando_chegada' }))

    await expect(
      servicoEntradaNotas.lancar('c1', 'nota-1', 'user-1', 'contagem')
    ).rejects.toThrow(ErroDaAplicacao)
    expect(repositorioEntradaNotas.atualizarNota).not.toHaveBeenCalled()
  })
})

describe('liberarParaContagem — sair de "Aguardando chegada"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('libera nota aguardando_chegada para entrada_contagem', async () => {
    const fake = ligarRepositorioFake(notaLancada({ statusEntrada: 'aguardando_chegada' }))

    const detalhe = await servicoEntradaNotas.liberarParaContagem('c1', 'nota-1')

    expect(fake.getEstado().statusEntrada).toBe('entrada_contagem')
    expect(detalhe.nota.statusEntrada).toBe('entrada_contagem')
    expect(repositorioEntradaNotas.atualizarNota).toHaveBeenCalledWith('nota-1', {
      statusEntrada: 'entrada_contagem',
    })
  })

  it('bloqueia liberar quando há divergência de nome sem aceite (409)', async () => {
    ligarRepositorioFake(
      notaLancada({
        itens: [itemComProduto('prod-a', 10, { descricao: 'Martelo', produto: {
          nomeVenda: 'Foice',
          ncm: '123',
          codigoOrigem: '0',
          sku: 'SKU',
          codigoBarras: null,
          marca: null,
          unidade: 'UN',
          pesoKg: null,
          controlaEstoque: true,
          fornecedores: [],
        } })],
      })
    )

    await expect(servicoEntradaNotas.liberarParaContagem('c1', 'nota-1')).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('rejeita liberar nota que não está aguardando_chegada (409)', async () => {
    ligarRepositorioFake(notaLancada({ statusEntrada: 'em_analise' }))

    await expect(servicoEntradaNotas.liberarParaContagem('c1', 'nota-1')).rejects.toThrow(
      ErroDaAplicacao
    )
    expect(repositorioEntradaNotas.atualizarNota).not.toHaveBeenCalled()
  })

  it('rejeita nota inexistente (404)', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(null as never)

    await expect(servicoEntradaNotas.liberarParaContagem('c1', 'nota-inexistente')).rejects.toThrow(
      ErroDaAplicacao
    )
  })
})
