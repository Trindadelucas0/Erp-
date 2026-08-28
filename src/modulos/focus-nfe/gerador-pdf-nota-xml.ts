/**
 * PDF legível gerado do XML salvo no ERP (quando a Focus não devolve DANFE/DACTe).
 * Não substitui o documento oficial da SEFAZ — entrega download útil ao usuário.
 */
import PDFDocument from 'pdfkit'
import { montarVisualizacaoDoXml } from './parser-xml-nfe.js'

function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR')
}

export async function gerarPdfLegivelDoXml(xmlBruto: string): Promise<Buffer> {
  const v = montarVisualizacaoDoXml(xmlBruto)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const partes: Buffer[] = []
    doc.on('data', (chunk) => partes.push(chunk as Buffer))
    doc.on('end', () => resolve(Buffer.concat(partes)))
    doc.on('error', reject)

    const tituloTipo =
      v.tipoDocumento === 'nfse'
        ? 'NFS-e (serviço)'
        : v.tipoDocumento === 'cte'
          ? 'CTe (transporte)'
          : 'NFe 55 (produto)'

    doc
      .fontSize(13)
      .text(`Prévia do documento fiscal — ${tituloTipo}`, { align: 'center' })
    doc
      .fontSize(9)
      .fillColor('#555555')
      .text('Gerado do XML armazenado no ERP (não é o DANFE/DACTe oficial da Focus).', {
        align: 'center',
      })
    doc.fillColor('#000000')
    doc.moveDown(1.2)

    doc.fontSize(10)
    doc.text(`Chave: ${v.chaveNfe ?? '—'}`)
    if (v.numero || v.serie) {
      doc.text(`Nº ${v.numero ?? '—'}${v.serie ? ` · Série ${v.serie}` : ''}`)
    }
    if (v.naturezaOperacao) doc.text(`Natureza: ${v.naturezaOperacao}`)
    doc.text(`Emissão: ${formatarData(v.dataEmissao)}`)
    doc.text(`Valor total: ${formatarMoeda(v.valorTotal)}`)
    if (v.prazoPagamento) doc.text(`Pagamento: ${v.prazoPagamento}`)
    doc.moveDown()

    const rotuloEmit =
      v.tipoDocumento === 'nfse' ? 'Prestador' : v.tipoDocumento === 'cte' ? 'Emitente' : 'Emitente'
    doc.fontSize(11).text(rotuloEmit, { underline: true })
    doc.fontSize(10)
    doc.text(v.emitente.nome ?? '—')
    doc.text(`Documento: ${v.emitente.documento ?? '—'}`)
    if (v.emitente.endereco) doc.text(v.emitente.endereco)
    doc.moveDown()

    doc.fontSize(11).text('Destinatário / Tomador', { underline: true })
    doc.fontSize(10)
    doc.text(v.destinatario.nome ?? '—')
    doc.text(`Documento: ${v.destinatario.documento ?? '—'}`)
    doc.moveDown()

    if (v.descricaoServico) {
      doc.fontSize(11).text('Serviço', { underline: true })
      doc.fontSize(10).text(v.descricaoServico, { width: 500 })
      doc.moveDown()
    }

    if (v.itens.length > 0) {
      doc.fontSize(11).text('Itens', { underline: true })
      doc.moveDown(0.4)
      doc.fontSize(9)
      for (const item of v.itens) {
        const linha =
          `${item.nItem}. ${item.descricao ?? '—'} · Qtd ${item.quantidade ?? '—'} · ` +
          `Unit ${formatarMoeda(item.valorUnitario)} · Total ${formatarMoeda(item.valorTotal)}`
        doc.text(linha, { width: 500 })
        if (item.ncm || item.cfop) {
          doc.fillColor('#555555').text(`NCM ${item.ncm ?? '—'} · CFOP ${item.cfop ?? '—'}`)
          doc.fillColor('#000000')
        }
        doc.moveDown(0.3)
      }
    }

    doc.end()
  })
}
