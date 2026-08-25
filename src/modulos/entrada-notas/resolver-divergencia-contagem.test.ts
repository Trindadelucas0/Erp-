import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-entrada-notas.js', () => ({
  repositorioEntradaNotas: {
    buscarNotaCompleta: vi.fn(),
    buscarNotaPorId: vi.fn(),
    atualizarNota: vi.fn(),
    atualizarItem: vi.fn(),
    criarAnexoDivergencia: vi.fn(),
    criarAnexoEntradaNota: vi.fn(),
    buscarAnexoEntradaNota: vi.fn(),
    somarConsolidadoPorProduto: vi.fn().mockResolvedValue(new Map()),
    buscarUltimoPrecoConsolidadoPorProduto: vi.fn().mockResolvedValue(new Map()),
    atualizarStatusPedidoCompra: vi.fn(),
    buscarPedidoComItens: vi.fn(),
    listarPedidosAbertosFornecedor: vi.fn().mockResolvedValue([]),
    mapaCodigoOriginalPorProduto: vi.fn().mockResolvedValue(new Map()),
  },
}))

vi.mock('./armazenamento-anexo-entrada-nota.js', () => ({
  salvarAnexoEntradaNota: vi.fn(),
  caminhoAbsolutoAnexoEntradaNota: vi.fn((caminho: string) => `/abs/${caminho}`),
}))

vi.mock('../autenticacao/servico-autenticacao.js', () => ({
  servicoDeAutenticacao: {
    verificarSenhaDoUsuario: vi.fn(),
  },
}))

vi.mock('../estoque/servico-estoque.js', () => ({
  servicoDeEstoque: {
    obterResumoEntradaNotaFiscal: vi.fn(),
    aplicarEntradaNotaFiscal: vi.fn(),
    registrarMovimentoEstoque: vi.fn(),
    obterItensBloqueadosDivergencia: vi.fn().mockResolvedValue({
      itens: [],
      totais: { itens: 0, aindaBloqueados: 0, desbloqueados: 0 },
    }),
    desbloquearMovimentosDivergenciaNota: vi.fn().mockResolvedValue({ movimentos: 1 }),
  },
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

vi.mock('../contagens/repositorio-contagens.js', () => ({
  repositorioContagens: {
    buscarSessaoFinalizadaDaNota: vi.fn().mockResolvedValue({
      id: 'sessao-1',
      baixadaEm: new Date('2026-08-19'),
      notas: [{ nfeRecebidaId: 'nota-1' }],
    }),
    marcarSessaoBaixada: vi.fn(),
    reabrirSessaoAposBaixa: vi.fn(),
  },
}))

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    contaPagar: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('../contas-a-pagar/gerar-titulos-entrada.js', () => ({
  gerarTitulosContasPagarDaEntrada: vi.fn().mockResolvedValue({ gerados: 0, contas: [] }),
}))

import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import { repositorioContagens } from '../contagens/repositorio-contagens.js'
import { salvarAnexoEntradaNota } from './armazenamento-anexo-entrada-nota.js'
import { servicoDeAutenticacao } from '../autenticacao/servico-autenticacao.js'
import { servicoDeEstoque } from '../estoque/servico-estoque.js'
import { servicoEntradaNotas } from './servico-pipeline-entrada.js'
import { gerarTitulosContasPagarDaEntrada } from '../contas-a-pagar/gerar-titulos-entrada.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

function itemComProduto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    nItem: 1,
    produtoId: 'prod-1',
    quantidade: 10,
    valorUnitario: 5,
    descricao: 'Item',
    cfop: '5102',
    cfopEntradaId: 'cfop-ent',
    produto: {
      nomeVenda: 'Produto',
      controlaEstoque: true,
      fornecedores: [],
    },
    ...overrides,
  }
}

function notaDivergente(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    companyId: 'c1',
    chaveNfe: '3'.repeat(44),
    statusEntrada: 'entrada_contagem_divergente',
    tipoDocumento: 'nfe55',
    modFrete: null,
    fornecedorPessoaId: 'pessoa-a',
    pedidoCompraId: null,
    fornecedorPessoa: { papeis: [] },
    itens: [itemComProduto()],
    tratativas: [],
    vinculosComoNfe: [],
    vinculosComoCte: [],
    despesasEntrada: [],
    analiseJson: null,
    ...overrides,
  }
}

const anexoDados = {
  senha: 'senha-correta',
  explicacao: 'Fornecedor reconheceu a falta e negociou bloqueio temporário.',
  anexo: {
    mimeType: 'application/pdf',
    base64Arquivo: 'data:application/pdf;base64,AAAA',
    nomeArquivo: 'negociacao.pdf',
  },
}

describe('resolverDivergenciaContagem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioEntradaNotas.atualizarNota).mockResolvedValue({} as never)
    vi.mocked(repositorioEntradaNotas.atualizarItem).mockResolvedValue(undefined as never)
    vi.mocked(repositorioEntradaNotas.criarAnexoEntradaNota).mockResolvedValue({
      id: 'anexo-1',
    } as never)
    vi.mocked(salvarAnexoEntradaNota).mockResolvedValue({
      caminhoArquivo: 'entrada-notas/nota-1/arquivo.pdf',
      tamanhoBytes: 1234,
    })
    vi.mocked(servicoDeAutenticacao.verificarSenhaDoUsuario).mockResolvedValue(true)
    vi.mocked(servicoDeEstoque.aplicarEntradaNotaFiscal).mockResolvedValue({
      movimentou: true,
      itensProcessados: 1,
      itensIgnorados: 0,
      movimentosGravados: 1,
      produtos: [],
    } as never)
    vi.mocked(servicoDeEstoque.registrarMovimentoEstoque).mockResolvedValue(undefined as never)
  })

  it('recusa (409) fora do status entrada_contagem_divergente', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaDivergente({ statusEntrada: 'entrada_contagem_ok' }) as never
    )

    await expect(
      servicoEntradaNotas.resolverDivergenciaContagem('c1', 'nota-1', 'user-1', anexoDados)
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('recusa (400) sem senha', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaDivergente() as never
    )

    await expect(
      servicoEntradaNotas.resolverDivergenciaContagem('c1', 'nota-1', 'user-1', {
        ...anexoDados,
        senha: '',
      })
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(servicoDeAutenticacao.verificarSenhaDoUsuario).not.toHaveBeenCalled()
  })

  it('recusa (403) com senha errada', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaDivergente() as never
    )
    vi.mocked(servicoDeAutenticacao.verificarSenhaDoUsuario).mockResolvedValue(false)

    await expect(
      servicoEntradaNotas.resolverDivergenciaContagem('c1', 'nota-1', 'user-1', anexoDados)
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(salvarAnexoEntradaNota).not.toHaveBeenCalled()
  })

  it('recusa (400) sem anexo', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaDivergente() as never
    )

    await expect(
      servicoEntradaNotas.resolverDivergenciaContagem('c1', 'nota-1', 'user-1', {
        senha: 'senha-correta',
        anexo: { mimeType: '', base64Arquivo: '', nomeArquivo: '' },
      })
    ).rejects.toBeInstanceOf(ErroDaAplicacao)
    expect(salvarAnexoEntradaNota).not.toHaveBeenCalled()
  })

  it('sucesso: grava anexo, lança estoque físico/fiscal, bloqueia por item e consolida', async () => {
    const nota = notaDivergente()
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(nota as never)

    const resultado = await servicoEntradaNotas.resolverDivergenciaContagem(
      'c1',
      'nota-1',
      'user-1',
      anexoDados
    )

    expect(servicoDeAutenticacao.verificarSenhaDoUsuario).toHaveBeenCalledWith(
      'user-1',
      'senha-correta'
    )
    expect(salvarAnexoEntradaNota).toHaveBeenCalledWith(
      'nota-1',
      'application/pdf',
      anexoDados.anexo.base64Arquivo
    )
    expect(repositorioEntradaNotas.criarAnexoEntradaNota).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'c1',
        nfeRecebidaId: 'nota-1',
        tipoAnexo: 'negociacao_bloqueio',
        nomeArquivo: 'negociacao.pdf',
        mimeType: 'application/pdf',
        caminhoArquivo: 'entrada-notas/nota-1/arquivo.pdf',
        tamanhoBytes: 1234,
        usuarioId: 'user-1',
      })
    )

    // Lançamento físico/fiscal (mesmo passo do Consolidar normal)
    expect(servicoDeEstoque.aplicarEntradaNotaFiscal).toHaveBeenCalled()

    // Bloqueio por item com produto e controle de estoque
    expect(servicoDeEstoque.registrarMovimentoEstoque).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'c1',
        produtoId: 'prod-1',
        dimensao: 'bloqueio',
        tipoMovimento: 'bloqueio',
        quantidade: 10,
        origem: 'nfe_divergencia',
        origemId: 'nota-1',
        chaveIdempotencia: 'nfe:nota-1:item:item-1:bloqueio',
      })
    )

    // Status final da nota
    expect(repositorioEntradaNotas.atualizarNota).toHaveBeenCalledWith(
      'nota-1',
      expect.objectContaining({
        statusEntrada: 'entrada_consolidada',
        divergenciaDesfecho: 'bloqueio',
        divergenciaResolvidaEm: expect.any(Date),
      })
    )

    expect(resultado.nota).toBeDefined()
    expect(gerarTitulosContasPagarDaEntrada).toHaveBeenCalledWith('c1', 'nota-1', {
      exigirVencimentoMercadoria: false,
    })
  })

  it('não bloqueia itens sem controle de estoque', async () => {
    const nota = notaDivergente({
      itens: [
        itemComProduto({
          id: 'item-2',
          produtoId: 'prod-2',
          produto: { nomeVenda: 'Sem controle', controlaEstoque: false, fornecedores: [] },
        }),
      ],
    })
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(nota as never)

    await servicoEntradaNotas.resolverDivergenciaContagem('c1', 'nota-1', 'user-1', anexoDados)

    expect(servicoDeEstoque.registrarMovimentoEstoque).not.toHaveBeenCalled()
  })

  it('recalcula status do pedido quando a nota está vinculada a um pedido de compra', async () => {
    const nota = notaDivergente({ pedidoCompraId: 'pedido-1' })
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(nota as never)
    vi.mocked(repositorioEntradaNotas.buscarPedidoComItens).mockResolvedValue({
      id: 'pedido-1',
      status: 'enviado',
      itens: [{ produtoId: 'prod-1', quantidade: 10 }],
    } as never)
    vi.mocked(repositorioEntradaNotas.somarConsolidadoPorProduto).mockResolvedValue(
      new Map([['prod-1', 10]])
    )

    await servicoEntradaNotas.resolverDivergenciaContagem('c1', 'nota-1', 'user-1', anexoDados)

    expect(repositorioEntradaNotas.atualizarStatusPedidoCompra).toHaveBeenCalledWith(
      'pedido-1',
      'recebido'
    )
  })

  it('recusa bloquear (409) se a contagem ainda não foi baixada', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaDivergente() as never
    )
    vi.mocked(repositorioContagens.buscarSessaoFinalizadaDaNota).mockResolvedValue({
      id: 'sessao-1',
      baixadaEm: null,
      notas: [{ nfeRecebidaId: 'nota-1' }],
    } as never)

    await expect(
      servicoEntradaNotas.resolverDivergenciaContagem('c1', 'nota-1', 'user-1', anexoDados)
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('baixarContagem / voltarParaContagem / desbloquear', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioEntradaNotas.atualizarNota).mockResolvedValue({} as never)
    vi.mocked(repositorioContagens.buscarSessaoFinalizadaDaNota).mockResolvedValue({
      id: 'sessao-1',
      baixadaEm: null,
      notas: [{ nfeRecebidaId: 'nota-1' }],
    } as never)
    vi.mocked(repositorioContagens.marcarSessaoBaixada).mockResolvedValue({} as never)
    vi.mocked(repositorioContagens.reabrirSessaoAposBaixa).mockResolvedValue(undefined as never)
    vi.mocked(salvarAnexoEntradaNota).mockResolvedValue({
      caminhoArquivo: 'entrada-notas/nota-1/arquivo.pdf',
      tamanhoBytes: 10,
    })
    vi.mocked(repositorioEntradaNotas.criarAnexoEntradaNota).mockResolvedValue({
      id: 'anexo-2',
    } as never)
    vi.mocked(servicoDeAutenticacao.verificarSenhaDoUsuario).mockResolvedValue(true)
    vi.mocked(servicoDeEstoque.registrarMovimentoEstoque).mockResolvedValue(undefined as never)
  })

  it('baixa divergente sem consolidar', async () => {
    const nota = notaDivergente()
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(nota as never)

    await servicoEntradaNotas.baixarContagem('c1', 'nota-1', 'user-1')

    expect(repositorioContagens.marcarSessaoBaixada).toHaveBeenCalledWith('sessao-1')
    expect(servicoDeEstoque.aplicarEntradaNotaFiscal).not.toHaveBeenCalled()
  })

  it('voltar para contagem reabre sessão baixada', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaDivergente() as never
    )
    vi.mocked(repositorioContagens.buscarSessaoFinalizadaDaNota).mockResolvedValue({
      id: 'sessao-1',
      baixadaEm: new Date(),
      observacao: null,
      notas: [{ nfeRecebidaId: 'nota-1' }],
      itens: [
        {
          produtoId: 'p1',
          nomeExibicao: 'Produto',
          qtdContada: 10,
          statusItem: 'divergente',
          produto: { sku: 'SKU1' },
        },
      ],
    } as never)

    await servicoEntradaNotas.voltarParaContagem('c1', 'nota-1', 'user-1')

    expect(repositorioContagens.reabrirSessaoAposBaixa).toHaveBeenCalledWith(
      expect.objectContaining({
        sessaoId: 'sessao-1',
        nfeRecebidaIds: ['nota-1'],
        usuarioId: 'user-1',
      })
    )
  })

  it('voltar para contagem funciona sem baixa (após Finalizar)', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaDivergente() as never
    )
    vi.mocked(repositorioContagens.buscarSessaoFinalizadaDaNota).mockResolvedValue({
      id: 'sessao-1',
      baixadaEm: null,
      observacao: null,
      notas: [{ nfeRecebidaId: 'nota-1' }],
      itens: [],
    } as never)

    await servicoEntradaNotas.voltarParaContagem('c1', 'nota-1', 'admin-1')

    expect(repositorioContagens.reabrirSessaoAposBaixa).toHaveBeenCalledWith(
      expect.objectContaining({
        sessaoId: 'sessao-1',
        usuarioId: 'admin-1',
      })
    )
  })

  it('não volta se já consolidou', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(
      notaDivergente({ statusEntrada: 'entrada_consolidada' }) as never
    )

    await expect(
      servicoEntradaNotas.voltarParaContagem('c1', 'nota-1', 'user-1')
    ).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('desbloqueia estoque com movimento negativo', async () => {
    const nota = notaDivergente({
      statusEntrada: 'entrada_consolidada',
      divergenciaDesfecho: 'bloqueio',
    })
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(nota as never)

    await servicoEntradaNotas.desbloquearEstoqueDivergencia('c1', 'nota-1', 'user-1', anexoDados)

    expect(servicoDeEstoque.desbloquearMovimentosDivergenciaNota).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'c1',
        notaId: 'nota-1',
        usuarioId: 'user-1',
        observacao: expect.stringContaining('Desbloqueio após divergência'),
      })
    )
    expect(repositorioEntradaNotas.criarAnexoEntradaNota).toHaveBeenCalledWith(
      expect.objectContaining({ tipoAnexo: 'negociacao_desbloqueio' })
    )
  })
})
