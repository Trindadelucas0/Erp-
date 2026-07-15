/**
 * Gera o .xlsx do pedido de compra para o fornecedor baixar no portal.
 */
import ExcelJS from 'exceljs'
import type { PedidoCompraView } from '../pedidos-compra/repositorio-pedidos-compra.js'

export async function gerarExcelPedidoCompra(pedido: PedidoCompraView): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const planilha = workbook.addWorksheet(`Pedido ${pedido.numero}`)

  planilha.addRow(['Pedido de compra', `#${pedido.numero}`])
  planilha.addRow(['Fornecedor', pedido.fornecedorNome])
  planilha.addRow(['Condição de pagamento', pedido.condicaoPagamento ?? '—'])
  planilha.addRow(['Transporte', pedido.modalidadeTransporte ?? '—'])
  planilha.addRow([
    'Previsão de entrega',
    pedido.previsaoEntrega ? pedido.previsaoEntrega.toISOString().slice(0, 10) : '—',
  ])
  planilha.addRow([])

  const linhaCabecalho = planilha.addRow([
    'Código',
    'Produto',
    'Unidade',
    'Quantidade',
    'Preço unitário',
    'Total',
  ])
  linhaCabecalho.font = { bold: true }

  for (const item of pedido.itens) {
    planilha.addRow([
      item.codigoOriginal ?? item.produtoSku ?? '',
      item.produtoNome,
      item.unidade,
      item.quantidade,
      item.precoUnitario,
      item.totalLiquido,
    ])
  }

  planilha.addRow([])
  planilha.addRow(['', '', '', '', 'Total do pedido', pedido.totalLiquido])

  planilha.columns.forEach((coluna) => {
    coluna.width = 24
  })

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
