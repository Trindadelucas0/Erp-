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
    buscarFlagsFornecedorEntrada: vi.fn(),
    buscarProdutoPorGtin: vi.fn(),
    buscarProdutoPorCodigoOriginal: vi.fn(),
    listarPedidosAbertosFornecedor: vi.fn(),
    buscarPedidoComItens: vi.fn(),
    gravarCodigoOriginalVinculo: vi.fn(),
    mapaCodigoOriginalPorProduto: vi.fn(),
    atualizarFiscalProduto: vi.fn(),
    mapaSugestaoCfopEntradaPorCodigo: vi.fn(),
    buscarCfopEntradaAtivo: vi.fn(),
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
  repositorioFocusNfe: {
    buscarConfigPorEmpresa: vi.fn().mockResolvedValue(null),
    buscarEmpresaCnpj: vi.fn().mockResolvedValue(null),
    upsertNfeRecebida: vi.fn(),
    atualizarDanfe: vi.fn(),
  },
}))

vi.mock('../focus-nfe/cliente-focus-nfe.js', () => ({
  clienteFocusNfe: {
    manifestar: vi.fn(),
    baixarXml: vi.fn(),
    consultarNfeRecebida: vi.fn(),
  },
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
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

/**
 * Substitui analisarCadastro por uma versão sem I/O que preserva o que já veio
 * em cada item (não inventa auto-match) — usado nos testes de vincular/desvincular
 * que só querem verificar a orquestração do serviço, não a regra de auto-match
 * (essa é coberta em analise-cadastro/analisar-cadastro.test.ts).
 */
function mockAnalisarCadastroPassthrough() {
  vi.mocked(analisarCadastro).mockImplementation(async ({ itens, fornecedorPessoaId }) => {
    const itensAtualizados = itens.map((item) => ({
      id: item.id,
      produtoId: item.produtoId,
      vinculoModo: item.vinculoModo,
      criticaCadastro: !item.produtoId,
    }))
    const bloqueios = itensAtualizados
      .filter((item) => !item.produtoId)
      .map((item) => `Item ${item.id} sem vínculo de produto.`)
    return {
      resultado: {
        status: bloqueios.length > 0 ? 'bloqueante' : 'ok',
        avisos: [],
        bloqueios,
      },
      fornecedorPessoaId: fornecedorPessoaId ?? 'fornecedor-1',
      itensAtualizados,
    } as never
  })
}

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
        cfopEntradaId: null,
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
      itens: notaEstado.itens.map((item) =>
        item.id === id ? { ...item, ...dados } : item
      ) as typeof notaEstado.itens,
    }
    return notaEstado.itens.find((item) => item.id === id) as never
  })
  vi.mocked(repositorioEntradaNotas.contarItens).mockResolvedValue(1)
  vi.mocked(repositorioEntradaNotas.listarPedidosAbertosFornecedor).mockResolvedValue([])
  vi.mocked(repositorioEntradaNotas.mapaCodigoOriginalPorProduto).mockResolvedValue(new Map())
  vi.mocked(repositorioEntradaNotas.buscarFlagsFornecedorEntrada).mockResolvedValue(null)

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

  it('permite voltar para frete (1ª etapa) e zera custoFreteRateado', async () => {
    ligarRepositorioFake(
      buildNotaFixture({
        statusEntrada: 'em_analise',
        etapaAtual: 'cadastro',
        origemLancamento: null,
        modFrete: '1',
        itens: [
          {
            id: 'item-1',
            nItem: 1,
            descricao: 'Item',
            gtin: null,
            codigoProduto: null,
            ncm: null,
            cfop: null,
            cst: null,
            origem: null,
            quantidade: 1,
            valorUnitario: 10,
            valorTotal: 10,
            pesoKg: null,
            custoFreteRateado: 5.5,
            cfopEntradaId: null,
            produtoId: 'produto-1',
            vinculoModo: 'barras',
            criticaCadastro: false,
            criticaFiscal: false,
            criticaNegociacao: false,
            produto: null,
          },
        ],
        analiseJson: {
          versao: 1,
          atualizadoEm: new Date().toISOString(),
          frete: { status: 'ok', avisos: [], bloqueios: [] },
          cadastro: { status: 'ok', avisos: [], bloqueios: [] },
          fiscal: { status: 'pendente', avisos: [], bloqueios: [] },
          negociacao: { status: 'pendente', avisos: [], bloqueios: [] },
          autoLancado: false,
          motivoParada: null,
        },
        vinculosComoNfe: [],
        fornecedorPessoa: {
          papeis: [{ dadosFornecedor: { regraRateioFrete: 'valor' } }],
        },
      })
    )

    const resultado = await servicoEntradaNotas.voltarEtapa(
      'empresa-1',
      'nota-1',
      'usuario-1',
      'frete'
    )

    const nota = resultado.nota as {
      etapaAtual: string
      itens: Array<{ custoFreteRateado: number | null }>
      analise: { motivoParada: string | null; frete: { status: string } }
    }
    expect(nota.etapaAtual).toBe('frete')
    expect(nota.analise.motivoParada).toBe('frete')
    expect(nota.analise.frete.status).toBe('bloqueante')
    expect(nota.itens[0]?.custoFreteRateado).toBeNull()
    expect(analisarCadastro).not.toHaveBeenCalled()
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

describe('servicoEntradaNotas.descancelar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(analisarCadastro).mockResolvedValue({
      resultado: { status: 'bloqueante', avisos: [], bloqueios: ['Item sem vínculo'] },
      fornecedorPessoaId: 'fornecedor-1',
      itensAtualizados: [
        { id: 'item-1', produtoId: 'produto-errado', vinculoModo: 'barras', criticaCadastro: false },
      ],
    } as never)
  })

  it('reverte nota cancelada para em_analise e limpa manifestacaoDestinatario', async () => {
    const fake = ligarRepositorioFake(
      buildNotaFixture({
        statusEntrada: 'cancelada',
        manifestacaoDestinatario: 'desconhecimento_da_operacao',
        etapaAtual: 'lancamento',
        origemLancamento: null,
      })
    )

    const resultado = await servicoEntradaNotas.descancelar('empresa-1', 'nota-1')

    const nota = resultado.nota as Record<string, unknown>
    expect(nota.statusEntrada).toBe('em_analise')
    expect(fake.getEstado().manifestacaoDestinatario).toBeNull()
  })

  it('rejeita descancelar nota que não está cancelada', async () => {
    ligarRepositorioFake(buildNotaFixture({ statusEntrada: 'em_analise' }))

    await expect(
      servicoEntradaNotas.descancelar('empresa-1', 'nota-1')
    ).rejects.toMatchObject({ message: expect.stringContaining('não está cancelada') })
  })
})

describe('servicoEntradaNotas.desvincularItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAnalisarCadastroPassthrough()
  })

  it('rejeita desvincular item já vinculado (vínculo travado)', async () => {
    ligarRepositorioFake(buildNotaFixture())

    await expect(
      servicoEntradaNotas.desvincularItem('empresa-1', 'nota-1', 'item-1')
    ).rejects.toMatchObject({
      message: expect.stringContaining('Vínculo travado'),
      statusCode: 409,
    })
    expect(repositorioEntradaNotas.atualizarItem).not.toHaveBeenCalled()
  })

  it('rejeita desvincular item em nota cancelada', async () => {
    ligarRepositorioFake(buildNotaFixture({ statusEntrada: 'cancelada' }))

    await expect(
      servicoEntradaNotas.desvincularItem('empresa-1', 'nota-1', 'item-1')
    ).rejects.toBeInstanceOf(ErroDaAplicacao)
    expect(repositorioEntradaNotas.atualizarItem).not.toHaveBeenCalled()
  })

  it('rejeita desvincular item sem produto', async () => {
    ligarRepositorioFake(
      buildNotaFixture({
        statusEntrada: 'em_analise',
        itens: [
          {
            id: 'item-1',
            nItem: 1,
            descricao: 'Sem vínculo',
            gtin: null,
            codigoProduto: null,
            ncm: null,
            cfop: null,
            cst: null,
            origem: null,
            quantidade: 1,
            valorUnitario: 10,
            valorTotal: 10,
            pesoKg: null,
            custoFreteRateado: null,
            cfopEntradaId: null,
            produtoId: null,
            vinculoModo: null,
            criticaCadastro: true,
            criticaFiscal: false,
            criticaNegociacao: false,
            produto: null,
          },
        ],
      })
    )

    await expect(
      servicoEntradaNotas.desvincularItem('empresa-1', 'nota-1', 'item-1')
    ).rejects.toMatchObject({
      message: expect.stringContaining('sem vínculo'),
      statusCode: 400,
    })
    expect(repositorioEntradaNotas.atualizarItem).not.toHaveBeenCalled()
  })
})

describe('servicoEntradaNotas.vincularItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAnalisarCadastroPassthrough()
    vi.mocked(clientePrisma.produto.findFirst).mockResolvedValue({ id: 'produto-2' } as never)
  })

  it('vincular um item só atualiza aquele item e não religa item que estava desvinculado manualmente', async () => {
    ligarRepositorioFake(
      buildNotaFixture({
        statusEntrada: 'em_analise',
        etapaAtual: 'cadastro',
        origemLancamento: null,
        itens: [
          {
            id: 'item-1',
            nItem: 1,
            descricao: 'Item desvinculado manualmente',
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
            cfopEntradaId: null,
            produtoId: null,
            vinculoModo: 'desvinculado',
            criticaCadastro: true,
            criticaFiscal: false,
            criticaNegociacao: false,
            produto: null,
          },
          {
            id: 'item-2',
            nItem: 2,
            descricao: 'Item pendente de conciliação',
            gtin: '9999999999999',
            codigoProduto: 'XYZ',
            ncm: null,
            cfop: null,
            cst: null,
            origem: null,
            quantidade: 1,
            valorUnitario: 20,
            valorTotal: 20,
            pesoKg: null,
            custoFreteRateado: null,
            cfopEntradaId: null,
            produtoId: null,
            vinculoModo: null,
            criticaCadastro: true,
            criticaFiscal: false,
            criticaNegociacao: false,
            produto: null,
          },
        ],
      })
    )

    const resultado = await servicoEntradaNotas.vincularItem('empresa-1', 'nota-1', 'item-2', 'produto-2')

    const itens = (
      resultado.nota as { itens: Array<{ id: string; produtoId: string | null; vinculoModo: string | null }> }
    ).itens
    const item1 = itens.find((i) => i.id === 'item-1')
    const item2 = itens.find((i) => i.id === 'item-2')

    expect(item2?.produtoId).toBe('produto-2')
    expect(item2?.vinculoModo).toBe('manual')
    expect(item1?.produtoId).toBeNull()
    expect(item1?.vinculoModo).toBe('desvinculado')

    const nota = resultado.nota as { etapaAtual: string; analise: { motivoParada: string | null } }
    expect(nota.etapaAtual).toBe('cadastro')
    expect(analisarFiscalItens).not.toHaveBeenCalled()
    expect(analisarNegociacao).not.toHaveBeenCalled()
  })

  it('rejeita trocar vínculo de item já vinculado', async () => {
    ligarRepositorioFake(buildNotaFixture({ statusEntrada: 'em_analise', etapaAtual: 'cadastro', origemLancamento: null }))

    await expect(
      servicoEntradaNotas.vincularItem('empresa-1', 'nota-1', 'item-1', 'produto-2')
    ).rejects.toMatchObject({
      message: expect.stringContaining('Vínculo travado'),
      statusCode: 409,
    })
    expect(repositorioEntradaNotas.atualizarItem).not.toHaveBeenCalled()
  })

  it('rejeita vincular produto inexistente', async () => {
    vi.mocked(clientePrisma.produto.findFirst).mockResolvedValue(null)
    ligarRepositorioFake(
      buildNotaFixture({
        statusEntrada: 'em_analise',
        etapaAtual: 'cadastro',
        origemLancamento: null,
        itens: [
          {
            id: 'item-1',
            nItem: 1,
            descricao: 'Sem vínculo',
            gtin: null,
            codigoProduto: null,
            ncm: null,
            cfop: null,
            cst: null,
            origem: null,
            quantidade: 1,
            valorUnitario: 10,
            valorTotal: 10,
            pesoKg: null,
            custoFreteRateado: null,
            cfopEntradaId: null,
            produtoId: null,
            vinculoModo: null,
            criticaCadastro: true,
            criticaFiscal: false,
            criticaNegociacao: false,
            produto: null,
          },
        ],
      })
    )

    await expect(
      servicoEntradaNotas.vincularItem('empresa-1', 'nota-1', 'item-1', 'produto-inexistente')
    ).rejects.toBeInstanceOf(ErroDaAplicacao)
    expect(repositorioEntradaNotas.atualizarItem).not.toHaveBeenCalled()
  })
})
