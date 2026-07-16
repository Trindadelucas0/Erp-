/**
 * Gera o PDF do pedido de compra para o fornecedor baixar no portal.
 * Não mostra preço — só os dados necessários para o fornecedor montar o
 * documento oficial (código de barras, código original, produto, unidade
 * e quantidade).
 * Usa pdfkit — geração pura em Node, sem navegador headless.
 */
import PDFDocument from 'pdfkit'

const COR_TEXTO = '#1a1a1a'
const COR_TEXTO_FRACO = '#666666'
const COR_BORDA = '#dddddd'
const COR_NEUTRO_FUNDO = '#f3f4f6'

export type ItemPedidoParaPdf = {
  codigoOriginal: string | null
  codigoBarras: string | null
  produtoNome: string
  unidade: string
  quantidade: number
}

export type PedidoParaPdf = {
  numero: number
  fornecedorNome: string
  transportadoraNome: string | null
  modalidadeTransporte: string | null
  condicaoPagamento: string | null
  previsaoEntrega: Date | null
  observacoes: string | null
  itens: ItemPedidoParaPdf[]
}

export async function gerarPdfPedidoCompra(pedido: PedidoParaPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const partes: Buffer[] = []
    doc.on('data', (chunk: Buffer) => partes.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(partes)))
    doc.on('error', reject)

    const larguraUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right

    doc.fontSize(16).fillColor(COR_TEXTO).text(`Pedido de compra #${pedido.numero}`)
    doc.fontSize(10).fillColor(COR_TEXTO_FRACO).text(`Fornecedor: ${pedido.fornecedorNome}`)
    doc.moveDown(0.4)

    doc.fontSize(9).fillColor(COR_TEXTO)
    doc.text(`Condição de pagamento: ${pedido.condicaoPagamento ?? '—'}`)
    doc.text(
      `Transporte: ${pedido.modalidadeTransporte ?? '—'}${
        pedido.transportadoraNome ? ` (${pedido.transportadoraNome})` : ''
      }`
    )
    doc.text(
      `Previsão de entrega: ${
        pedido.previsaoEntrega ? pedido.previsaoEntrega.toISOString().slice(0, 10) : '—'
      }`
    )
    if (pedido.observacoes) {
      doc.text(`Observações: ${pedido.observacoes}`)
    }
    doc.moveDown(0.8)

    const colBarras = 100
    const colCodigo = 80
    const colUnidade = 50
    const colQuantidade = 70
    const colProduto = larguraUtil - colBarras - colCodigo - colUnidade - colQuantidade

    function cabecalhoTabela(): void {
      const y = doc.y
      doc.rect(doc.page.margins.left, y, larguraUtil, 18).fill(COR_NEUTRO_FUNDO)
      let x = doc.page.margins.left + 4
      doc.fillColor(COR_TEXTO_FRACO).fontSize(7.5)
      doc.text('CÓD. BARRAS', x, y + 5, { width: colBarras })
      x += colBarras
      doc.text('CÓD. ORIGINAL', x, y + 5, { width: colCodigo })
      x += colCodigo
      doc.text('PRODUTO', x, y + 5, { width: colProduto })
      x += colProduto
      doc.text('UN.', x, y + 5, { width: colUnidade })
      x += colUnidade
      doc.text('QTD.', x, y + 5, { width: colQuantidade, align: 'right' })
      doc.y = y + 18
    }

    cabecalhoTabela()

    pedido.itens.forEach((item) => {
      const alturaLinha = Math.max(20, doc.heightOfString(item.produtoNome, { width: colProduto - 4 }) + 8)

      if (doc.y + alturaLinha > doc.page.height - doc.page.margins.bottom) {
        doc.addPage()
        cabecalhoTabela()
      }

      const y = doc.y
      doc
        .moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.margins.left + larguraUtil, y)
        .stroke(COR_BORDA)

      let x = doc.page.margins.left + 4
      doc.fillColor(COR_TEXTO).fontSize(8).text(item.codigoBarras ?? '—', x, y + 6, { width: colBarras - 4 })
      x += colBarras
      doc.text(item.codigoOriginal ?? '—', x, y + 6, { width: colCodigo - 4 })
      x += colCodigo
      doc.text(item.produtoNome, x, y + 6, { width: colProduto - 4 })
      x += colProduto
      doc.text(item.unidade, x, y + 6, { width: colUnidade - 4 })
      x += colUnidade
      doc.text(String(item.quantidade), x, y + 6, { width: colQuantidade - 4, align: 'right' })

      doc.y = y + alturaLinha
    })

    doc.end()
  })
}
