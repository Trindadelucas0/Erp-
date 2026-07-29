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
import { servicoEntradaNotas } from './servico-pipeline-entrada.js'
import type { ItemXmlNfe } from '../focus-nfe/parser-xml-nfe.js'

const xmlAmostra = `
<NFe><infNFe Id="NFe35200114200166000187550010000000011000000015">
  <ide><dhEmi>2024-03-15T10:00:00-03:00</dhEmi></ide>
  <emit><CNPJ>11222333000181</CNPJ><xNome>FORNECEDOR SA</xNome></emit>
  <dest><CNPJ>29859815000102</CNPJ><xNome>EXITO</xNome></dest>
  <det nItem="1">
    <prod>
      <cProd>ABC123</cProd>
      <cEAN>7891234567890</cEAN>
      <xProd>Produto Teste</xProd>
      <NCM>22021000</NCM>
      <CFOP>5102</CFOP>
      <qCom>10.0000</qCom>
      <vUnCom>5.5000</vUnCom>
      <vProd>55.00</vProd>
    </prod>
    <imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST></ICMS00></ICMS></imposto>
  </det>
  <total><ICMSTot><vNF>55.00</vNF></ICMSTot></total>
</infNFe></NFe>`

describe('servicoEntradaNotas.sincronizarItensPendentesDoXml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extrai e grava itens do XML quando a NFe 55 ainda não tem nenhum', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockResolvedValue({
      id: 'nota-1',
      tipoDocumento: 'nfe55',
      xmlConteudo: xmlAmostra,
    } as never)
    vi.mocked(repositorioEntradaNotas.contarItens).mockResolvedValue(0)
    vi.mocked(repositorioEntradaNotas.substituirItensDoXml).mockResolvedValue([] as never)

    const resultado = await servicoEntradaNotas.sincronizarItensPendentesDoXml('empresa-1', 'nota-1')

    expect(resultado.itensAdicionados).toBe(1)
    expect(repositorioEntradaNotas.substituirItensDoXml).toHaveBeenCalledWith(
      'nota-1',
      expect.arrayContaining([expect.objectContaining({ codigoProduto: 'ABC123' } as Partial<ItemXmlNfe>)])
    )
  })

  it('não sobrescreve itens já gravados (preserva vínculo/CFOP já escolhidos)', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockResolvedValue({
      id: 'nota-1',
      tipoDocumento: 'nfe55',
      xmlConteudo: xmlAmostra,
    } as never)
    vi.mocked(repositorioEntradaNotas.contarItens).mockResolvedValue(1)
    vi.mocked(repositorioEntradaNotas.backfillUnidadeItensDoXml).mockResolvedValue(undefined)

    const resultado = await servicoEntradaNotas.sincronizarItensPendentesDoXml('empresa-1', 'nota-1')

    expect(resultado.itensAdicionados).toBe(0)
    expect(repositorioEntradaNotas.substituirItensDoXml).not.toHaveBeenCalled()
    expect(repositorioEntradaNotas.backfillUnidadeItensDoXml).toHaveBeenCalledWith(
      'nota-1',
      expect.arrayContaining([expect.objectContaining({ codigoProduto: 'ABC123' } as Partial<ItemXmlNfe>)])
    )
  })

  it('não faz nada para NFS-e/CTe (sem itens de produto por design)', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockResolvedValue({
      id: 'nota-1',
      tipoDocumento: 'nfse',
      xmlConteudo: '<NFSe></NFSe>',
    } as never)

    const resultado = await servicoEntradaNotas.sincronizarItensPendentesDoXml('empresa-1', 'nota-1')

    expect(resultado.itensAdicionados).toBe(0)
    expect(repositorioEntradaNotas.contarItens).not.toHaveBeenCalled()
    expect(repositorioEntradaNotas.substituirItensDoXml).not.toHaveBeenCalled()
  })

  it('não faz nada quando a nota não existe ou ainda não tem XML', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockResolvedValueOnce(null as never)
    const semNota = await servicoEntradaNotas.sincronizarItensPendentesDoXml('empresa-1', 'nota-x')
    expect(semNota.itensAdicionados).toBe(0)

    vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockResolvedValueOnce({
      id: 'nota-1',
      tipoDocumento: 'nfe55',
      xmlConteudo: null,
    } as never)
    const semXml = await servicoEntradaNotas.sincronizarItensPendentesDoXml('empresa-1', 'nota-1')
    expect(semXml.itensAdicionados).toBe(0)
    expect(repositorioEntradaNotas.contarItens).not.toHaveBeenCalled()
  })
})

function buildNotaQuebradaFixture(): Record<string, unknown> {
  return {
    id: 'nota-1',
    companyId: 'empresa-1',
    chaveNfe: '1'.repeat(44),
    tipoDocumento: 'nfe55',
    nomeEmitente: 'Fornecedor Teste',
    documentoEmitente: '11222333000181',
    valorTotal: 55,
    dataEmissao: null,
    statusEntrada: 'em_analise',
    origem: 'focus',
    etapaAtual: 'cadastro',
    nfeCompleta: true,
    criticasLiberadas: false,
    observacaoContato: null,
    pedidoCompraId: null,
    origemLancamento: null,
    prazoPagamentoXml: null,
    prazoPagamentoTexto: null,
    modFrete: null,
    chaveNfeReferenciada: null,
    xmlConteudo: xmlAmostra,
    fornecedorPessoaId: null,
    fornecedorPessoa: null,
    // Nota já foi analisada antes (analiseJson preenchido), mas ficou sem itens —
    // é o cenário real que motivou esta correção (sync pulou reparse do XML).
    analiseJson: {
      versao: 1,
      atualizadoEm: new Date().toISOString(),
      cadastro: { status: 'bloqueante', avisos: [], bloqueios: ['Fornecedor não cadastrado.'] },
      fiscal: { status: 'pendente', avisos: [], bloqueios: [] },
      negociacao: { status: 'pendente', avisos: [], bloqueios: [] },
      autoLancado: false,
      motivoParada: 'cadastro',
    },
    vinculosComoNfe: [],
    vinculosComoCte: [],
    despesasEntrada: [],
    itens: [],
  }
}

/** Fake repositório em memória: substituirItensDoXml/atualizarItem mutam o mesmo estado devolvido pelas buscas. */
function ligarRepositorioFake(estadoInicial: Record<string, unknown>) {
  let notaEstado = estadoInicial

  vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockImplementation(
    async () => JSON.parse(JSON.stringify(notaEstado)) as never
  )
  vi.mocked(repositorioEntradaNotas.buscarNotaPorId).mockImplementation(
    async () => JSON.parse(JSON.stringify(notaEstado)) as never
  )
  vi.mocked(repositorioEntradaNotas.contarItens).mockImplementation(
    async () => (notaEstado.itens as unknown[]).length
  )
  vi.mocked(repositorioEntradaNotas.substituirItensDoXml).mockImplementation(
    async (_id, itens: ItemXmlNfe[]) => {
      const novos = itens.map((item, indice) => ({
        id: `item-${indice + 1}`,
        ...item,
        custoFreteRateado: null,
        cfopEntradaId: null,
        produtoId: null,
        vinculoModo: null,
        criticaCadastro: false,
        criticaFiscal: false,
        criticaNegociacao: false,
        produto: null,
      }))
      notaEstado = { ...notaEstado, itens: novos }
      return novos as never
    }
  )
  vi.mocked(repositorioEntradaNotas.atualizarNota).mockImplementation(async (_id, dados) => {
    notaEstado = { ...notaEstado, ...dados }
    return JSON.parse(JSON.stringify(notaEstado)) as never
  })
  vi.mocked(repositorioEntradaNotas.atualizarItem).mockImplementation(async (id, dados) => {
    notaEstado = {
      ...notaEstado,
      itens: (notaEstado.itens as Array<Record<string, unknown>>).map((item) =>
        item.id === id ? { ...item, ...dados } : item
      ),
    }
    return (notaEstado.itens as Array<Record<string, unknown>>).find((item) => item.id === id) as never
  })
  vi.mocked(repositorioEntradaNotas.listarPedidosAbertosFornecedor).mockResolvedValue([])
  vi.mocked(repositorioEntradaNotas.mapaCodigoOriginalPorProduto).mockResolvedValue(new Map())

  return { getEstado: () => notaEstado }
}

describe('servicoEntradaNotas.obterDetalhe — reparo automático de itens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
        fornecedorPessoaId: fornecedorPessoaId ?? null,
        itensAtualizados,
      } as never
    })
  })

  it('ao abrir uma nota já analisada mas sem itens, extrai do XML salvo sem exigir clique em Reanalisar', async () => {
    ligarRepositorioFake(buildNotaQuebradaFixture())

    const resultado = await servicoEntradaNotas.obterDetalhe('empresa-1', 'nota-1')

    expect(repositorioEntradaNotas.substituirItensDoXml).toHaveBeenCalledTimes(1)

    const nota = resultado.nota as { itens: Array<{ codigoProduto: string | null }> }
    expect(nota.itens).toHaveLength(1)
    expect(nota.itens[0].codigoProduto).toBe('ABC123')
  })

  it('não reparseia nem duplica itens quando a nota já tem itens gravados', async () => {
    const fixture = buildNotaQuebradaFixture()
    fixture.itens = [
      {
        id: 'item-1',
        nItem: 1,
        descricao: 'Produto Teste',
        gtin: '7891234567890',
        codigoProduto: 'ABC123',
        ncm: '22021000',
        cfop: '5102',
        cst: '00',
        origem: '0',
        quantidade: 10,
        valorUnitario: 5.5,
        valorTotal: 55,
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
    ]
    ligarRepositorioFake(fixture)

    const resultado = await servicoEntradaNotas.obterDetalhe('empresa-1', 'nota-1')

    expect(repositorioEntradaNotas.substituirItensDoXml).not.toHaveBeenCalled()
    const nota = resultado.nota as { itens: unknown[] }
    expect(nota.itens).toHaveLength(1)
  })
})
