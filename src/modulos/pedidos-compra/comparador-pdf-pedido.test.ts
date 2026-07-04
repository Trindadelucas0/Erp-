import { describe, expect, it } from 'vitest'
import { compararPedidoComPdf } from './comparador-pdf-pedido.js'
import type { PedidoCompraView } from './repositorio-pedidos-compra.js'

const pedidoBase: PedidoCompraView = {
  id: '1',
  numero: 10,
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
  pedidoVendaId: null,
  pedidoVendaNumero: null,
  pedidoVendaCliente: null,
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
      produtoAtivo: true,
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
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('compararPedidoComPdf', () => {
  it('detecta divergência quando PDF não tem números do pedido', () => {
    const pdfVazio = Buffer.from('%PDF-1.4 fake').toString('base64')
    const resultado = compararPedidoComPdf(pedidoBase, pdfVazio)
    expect(resultado.temDivergencia).toBe(true)
    expect(resultado.divergencias.length).toBeGreaterThan(0)
  })

  it('não acusa divergência quando PDF contém valores do pedido', () => {
    const textoPdf = `
      Fornecedor ABC Ltda
      Produto X SKU001
      Quantidade: 10,000
      Preço unitário: 20,00
      Total: 200,00
    `
    const base64 = Buffer.from(textoPdf).toString('base64')
    const resultado = compararPedidoComPdf(pedidoBase, base64)
    const divergenciasAlta = resultado.divergencias.filter((d) => d.severidade === 'alta')
    expect(divergenciasAlta).toHaveLength(0)
  })
})
