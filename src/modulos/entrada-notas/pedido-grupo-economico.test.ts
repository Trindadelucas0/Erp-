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
    buscarFlagsFornecedorEntrada: vi.fn(),
    buscarProdutoPorGtin: vi.fn(),
    buscarProdutoPorCodigoOriginal: vi.fn(),
    listarPedidosAbertosFornecedor: vi.fn(),
    buscarPedidoComItens: vi.fn(),
    somarConsolidadoPorProduto: vi.fn().mockResolvedValue(new Map()),
    gravarCodigoOriginalVinculo: vi.fn(),
    mapaCodigoOriginalPorProduto: vi.fn(),
    atualizarFiscalProduto: vi.fn(),
    mapaSugestaoCfopEntradaPorCodigo: vi.fn(),
    buscarCfopEntradaAtivo: vi.fn(),
    buscarCfopEntradaCteAtivo: vi.fn(),
    listarNotasPendentesPorDocumento: vi.fn(),
    listarNotasPendentesSemFornecedor: vi.fn(),
    buscarUltimoPrecoConsolidadoPorProduto: vi.fn().mockResolvedValue(new Map()),
  },
}))

vi.mock('../contagens/repositorio-contagens.js', () => ({
  repositorioContagens: {
    buscarSessaoFinalizadaDaNota: vi.fn().mockResolvedValue(null),
    marcarSessaoBaixada: vi.fn(),
    reabrirSessaoAposBaixa: vi.fn(),
  },
}))

vi.mock('../fornecedores/vinculos-fornecedor.js', () => ({
  obterPessoaIdsRedePorPessoaId: vi.fn(),
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

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    produto: { findFirst: vi.fn() },
    despesaEntradaDocumento: { upsert: vi.fn() },
    contaPagar: { findMany: vi.fn().mockResolvedValue([]) },
    nfeRecebida: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}))

vi.mock('../autenticacao/servico-autenticacao.js', () => ({
  servicoDeAutenticacao: { verificarSenhaDoUsuario: vi.fn() },
}))

vi.mock('../contas-a-pagar/gerar-titulos-entrada.js', () => ({
  gerarTitulosContasPagarDaEntrada: vi.fn().mockResolvedValue({ gerados: 0, contas: [] }),
}))

vi.mock('../estoque/servico-estoque.js', () => ({
  servicoDeEstoque: {
    obterResumoEntradaNotaFiscal: vi.fn(),
    aplicarEntradaNotaFiscal: vi.fn(),
  },
}))

vi.mock('./servico-vinculo-cte.js', () => ({
  servicoVinculoCte: {
    tentarVincularCteAutomatico: vi.fn(),
  },
}))

import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import { obterPessoaIdsRedePorPessoaId } from '../fornecedores/vinculos-fornecedor.js'
import { analisarCadastro } from './analise-cadastro/analisar-cadastro.js'
import { analisarFiscalItens } from './analise-fiscal/analisar-fiscal-itens.js'
import { analisarNegociacao } from './analise-negociacao/analisar-negociacao.js'
import { servicoEntradaNotas } from './servico-pipeline-entrada.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

const xmlComDet = `<NFe><infNFe><det nItem="1"><prod><cProd>1</cProd></prod></det></infNFe></NFe>`

function notaBase(extra: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    companyId: 'company-1',
    chaveNfe: '1'.repeat(44),
    tipoDocumento: 'nfe55',
    statusEntrada: 'em_analise',
    etapaAtual: 'fiscal',
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
    itens: [
      {
        id: 'item-1',
        nItem: 1,
        produtoId: 'prod-1',
        quantidade: 1,
        valorUnitario: 10,
        descricao: 'Item',
        cfop: '5102',
        cfopEntradaId: 'cfop-ent',
        criticaFiscal: false,
        criticaNegociacao: false,
        vinculoModo: 'barras',
        produto: {
          nomeVenda: 'Produto',
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
      },
    ],
    fornecedorPessoa: {
      id: 'pessoa-a',
      nome: 'Emitente A',
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
    ctesComoNfe: [],
    vinculosComoNfe: [],
    vinculosComoCte: [],
    despesasEntrada: [],
    ...extra,
  }
}

function ligarRepositorioFake(estadoInicial: ReturnType<typeof notaBase>) {
  let notaEstado = { ...estadoInicial }

  vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockImplementation(
    async () => JSON.parse(JSON.stringify(notaEstado)) as never
  )
  vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockImplementation(
    async () => JSON.parse(JSON.stringify(notaEstado)) as never
  )
  vi.mocked(repositorioEntradaNotas.atualizarNota).mockImplementation(async (_id, dados) => {
    notaEstado = { ...notaEstado, ...dados }
    return JSON.parse(JSON.stringify(notaEstado)) as never
  })
  vi.mocked(repositorioEntradaNotas.atualizarItem).mockResolvedValue(undefined as never)
  vi.mocked(repositorioEntradaNotas.contarItens).mockResolvedValue(1)
  vi.mocked(repositorioEntradaNotas.backfillUnidadeItensDoXml).mockResolvedValue(0 as never)
  vi.mocked(repositorioEntradaNotas.mapaCodigoOriginalPorProduto).mockResolvedValue(new Map())
  vi.mocked(repositorioEntradaNotas.mapaSugestaoCfopEntradaPorCodigo).mockResolvedValue(new Map())
  vi.mocked(repositorioEntradaNotas.buscarFlagsFornecedorEntrada).mockResolvedValue(null)

  return {
    getEstado: () => notaEstado,
  }
}

describe('Negociação — pedidos pelo grupo econômico', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(obterPessoaIdsRedePorPessoaId).mockResolvedValue(['pessoa-a', 'pessoa-b'])
    vi.mocked(analisarCadastro).mockResolvedValue({
      resultado: { status: 'ok', avisos: [], bloqueios: [] },
      itensAtualizados: [],
      fornecedorPessoaId: 'pessoa-a',
    } as never)
    vi.mocked(analisarFiscalItens).mockReturnValue({
      resultado: { status: 'ok', avisos: [], bloqueios: [] },
      itensCritica: [],
    })
    vi.mocked(analisarNegociacao).mockReturnValue({
      resultado: { status: 'ok', avisos: [], bloqueios: [] },
      classificacao: 'ok',
      itensCritica: [{ id: 'item-1', criticaNegociacao: false }],
    })
  })

  it('definirPedido aceita PO de CNPJ relacionado do grupo', async () => {
    const fake = ligarRepositorioFake(notaBase())
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'po-rel',
      fornecedorPessoaId: 'pessoa-b',
      numero: 10,
      status: 'aprovado',
      condicaoPagamento: null,
      prazosPagamento: null,
      itens: [],
      fornecedor: { id: 'pessoa-b', nome: 'Relacionado B' },
    } as never)
    vi.mocked(repositorioEntradaNotas.listarPedidosAbertosFornecedor).mockResolvedValue([] as never)

    await servicoEntradaNotas.definirPedido('company-1', 'nota-1', 'po-rel')

    expect(obterPessoaIdsRedePorPessoaId).toHaveBeenCalledWith('pessoa-a', 'company-1')
    expect(fake.getEstado().pedidoCompraId).toBe('po-rel')
  })

  it('definirPedido recusa PO fora do grupo econômico (400)', async () => {
    ligarRepositorioFake(notaBase())
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'po-fora',
      fornecedorPessoaId: 'pessoa-x',
      numero: 99,
      status: 'aprovado',
      itens: [],
    } as never)

    await expect(
      servicoEntradaNotas.definirPedido('company-1', 'nota-1', 'po-fora')
    ).rejects.toBeInstanceOf(ErroDaAplicacao)

    await expect(
      servicoEntradaNotas.definirPedido('company-1', 'nota-1', 'po-fora')
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('auto-vincula único PO aberto de CNPJ relacionado na rede', async () => {
    const fake = ligarRepositorioFake(notaBase())
    const pedidoRelacionado = {
      id: 'po-1',
      numero: 1,
      status: 'aprovado',
      fornecedorPessoaId: 'pessoa-b',
      fornecedor: { id: 'pessoa-b', nome: 'B' },
      condicaoPagamento: null,
      prazosPagamento: null,
      itens: [
        {
          produtoId: 'prod-1',
          quantidade: 1,
          precoUnitario: 10,
          produto: { nomeVenda: 'Produto' },
        },
      ],
    }
    vi.mocked(repositorioEntradaNotas.listarPedidosAbertosFornecedor).mockResolvedValue([
      pedidoRelacionado,
    ] as never)

    await servicoEntradaNotas.analisarNota('company-1', 'nota-1', {
      importarFocusSeAusente: false,
    })

    expect(obterPessoaIdsRedePorPessoaId).toHaveBeenCalledWith('pessoa-a', 'company-1')
    expect(repositorioEntradaNotas.listarPedidosAbertosFornecedor).toHaveBeenCalledWith(
      'company-1',
      ['pessoa-a', 'pessoa-b']
    )
    expect(fake.getEstado().pedidoCompraId).toBe('po-1')
  })

  it('não auto-vincula quando há mais de um PO no grupo', async () => {
    const fake = ligarRepositorioFake(notaBase())
    vi.mocked(repositorioEntradaNotas.listarPedidosAbertosFornecedor).mockResolvedValue([
      {
        id: 'po-1',
        numero: 1,
        status: 'aprovado',
        fornecedorPessoaId: 'pessoa-a',
        fornecedor: { id: 'pessoa-a', nome: 'A' },
        itens: [],
      },
      {
        id: 'po-2',
        numero: 2,
        status: 'enviado',
        fornecedorPessoaId: 'pessoa-b',
        fornecedor: { id: 'pessoa-b', nome: 'B' },
        itens: [],
      },
    ] as never)

    await servicoEntradaNotas.analisarNota('company-1', 'nota-1', {
      importarFocusSeAusente: false,
    })

    expect(fake.getEstado().pedidoCompraId).toBeNull()
  })
})
