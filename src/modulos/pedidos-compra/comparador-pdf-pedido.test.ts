import { describe, expect, it, vi } from 'vitest'
import { compararPedidoComPdf } from './comparador-pdf-pedido.js'
import { extrairTextoDoPdf } from './extrator-texto-pdf.js'
import type { PedidoCompraView } from './repositorio-pedidos-compra.js'

vi.mock('./extrator-texto-pdf.js', () => ({
  extrairTextoDoPdf: vi.fn(),
}))

const pedidoBase: PedidoCompraView = {
  id: '1',
  numero: 10,
  descricao: null,
  fornecedorPessoaId: 'f1',
  fornecedorNome: 'Fornecedor ABC Ltda',
  transportadoraPessoaId: null,
  transportadoraNome: null,
  modalidadeTransporte: 'CIF',
  condicaoPagamento: '30 dias',
  tipoCompra: 'revenda',
  dataFaturamento: null,
  previsaoEntrega: null,
  valorFrete: null,
  valorFreteSugerido: null,
  prazosPagamento: null,
  rateioParcelas: 'igual',
  status: 'rascunho',
  motivoCancelamento: null,
  observacoes: null,
  observacoesInternas: null,
  copiadoDeId: null,
  creditoFornecedorId: null,
  creditoAplicado: null,
  totalPedido: 200,
  totalLiquido: 200,
  itens: [
    {
      id: 'i1',
      produtoId: 'p1',
      produtoNome: 'Produto X',
      produtoSku: 'SKU001',
      produtoMarca: 'Marca X',
      produtoAtivo: true,
      produtoCodigoBarras: null,
      produtoCodigoOrigem: null,
      produtoFotoArquivo: null,
      codigoOriginal: null,
      quantidade: 10,
      unidade: 'UN',
      precoUnitario: 20,
      percentualDesconto: null,
      valorDesconto: null,
      outrasDespesas: null,
      total: 200,
      totalLiquido: 200,
      previsaoEntrega: null,
      ordem: 0,
    },
  ],
  portalLiberadoEm: null,
  portalBloqueadoEm: null,
  anexosFornecedor: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('compararPedidoComPdf', () => {
  it('detecta divergência quando não é possível extrair texto do PDF', async () => {
    vi.mocked(extrairTextoDoPdf).mockResolvedValue('')

    const pdfVazio = Buffer.from('%PDF-1.4 fake').toString('base64')
    const resultado = await compararPedidoComPdf(pedidoBase, pdfVazio)
    expect(resultado.temDivergencia).toBe(true)
    expect(resultado.divergencias.length).toBeGreaterThan(0)
  })

  it('não acusa divergência quando o texto extraído contém os valores do pedido', async () => {
    vi.mocked(extrairTextoDoPdf).mockResolvedValue(`
      Fornecedor ABC Ltda
      Produto X SKU001
      Quantidade: 10,000
      Preço unitário: 20,00
      Total: 200,00
    `)

    const base64 = Buffer.from('conteudo pdf qualquer').toString('base64')
    const resultado = await compararPedidoComPdf(pedidoBase, base64)
    const divergenciasAlta = resultado.divergencias.filter((d) => d.severidade === 'alta')
    expect(divergenciasAlta).toHaveLength(0)
  })
})
