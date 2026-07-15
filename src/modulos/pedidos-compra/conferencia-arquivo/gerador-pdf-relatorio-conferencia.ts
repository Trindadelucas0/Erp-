/**
 * Gera o PDF do relatório de conferência (arquivo do fornecedor × pedido)
 * para o fornecedor baixar no portal quando o comprador solicita ajuste, ou
 * para o comprador baixar direto do modal "Conferir com IA" no ERP.
 * O layout replica o visual do modal: KPIs coloridos, selo de status,
 * caixa de motivo do ajuste e tabela de itens com foto do produto.
 * Usa pdfkit — geração pura em Node, sem navegador headless.
 */
import { readFileSync } from 'node:fs'
import PDFDocument from 'pdfkit'
import { caminhoAbsolutoPorUrlPublica } from '../../produtos/armazenamento-foto-produto.js'
import type {
  DivergenciaCampo,
  LinhaResultadoConferencia,
  RelatorioConferenciaArquivo,
  StatusGeralConferencia,
  StatusLinhaConferencia,
} from './tipos-conferencia.js'

export type StatusConferenciaAnexo = 'pendente' | 'aprovado' | 'ajuste_solicitado'

const COR_TEXTO = '#1a1a1a'
const COR_TEXTO_FRACO = '#666666'
const COR_BORDA = '#dddddd'
const COR_OK = '#0f766e'
const COR_ALERTA = '#b45309'
const COR_ALERTA_FUNDO = '#fef3c7'
const COR_ERRO = '#b91c1c'
const COR_ERRO_FUNDO = '#fee2e2'
const COR_NEUTRO_FUNDO = '#f3f4f6'

const ROTULO_STATUS_GERAL: Record<StatusGeralConferencia, string> = {
  ok: 'OK — sem divergências',
  divergencias: 'Divergências encontradas',
  falha_extracao: 'Falha na extração do documento',
}

const ROTULO_STATUS_LINHA: Record<StatusLinhaConferencia, { texto: string; cor: string; fundo: string }> = {
  ok: { texto: 'OK', cor: COR_OK, fundo: '#dcfce7' },
  divergente: { texto: 'Divergente', cor: COR_ALERTA, fundo: COR_ALERTA_FUNDO },
  sem_match_pedido: { texto: 'Sem no arquivo', cor: COR_ERRO, fundo: COR_ERRO_FUNDO },
  sobra_arquivo: { texto: 'Sobra no arquivo', cor: COR_ERRO, fundo: COR_ERRO_FUNDO },
}

const ROTULO_METODO: Record<LinhaResultadoConferencia['metodoMatch'], string> = {
  codigo_barras: 'Código de barras',
  codigo_original: 'Código original',
  nome_preco: 'Nome + preço',
  nenhum: '—',
}

const ROTULO_STATUS_DECISAO: Record<StatusConferenciaAnexo, { texto: string; cor: string; fundo: string }> = {
  pendente: { texto: 'Pendente de decisão', cor: COR_ALERTA, fundo: COR_ALERTA_FUNDO },
  aprovado: { texto: 'Aprovado', cor: COR_OK, fundo: '#dcfce7' },
  ajuste_solicitado: { texto: 'Ajuste solicitado', cor: COR_ERRO, fundo: COR_ERRO_FUNDO },
}

function nomeLinha(linha: LinhaResultadoConferencia): string {
  return linha.pedido?.nome ?? linha.arquivo?.descricao ?? '—'
}

function textoDivergencias(divergencias: DivergenciaCampo[]): string {
  if (divergencias.length === 0) return '—'
  return divergencias.map((d) => `${d.campo}: esperado "${d.esperado}" · encontrado "${d.encontrado}"`).join('\n')
}

function desenharSelo(
  doc: PDFKit.PDFDocument,
  texto: string,
  x: number,
  y: number,
  cor: string,
  fundo: string
): number {
  const largura = doc.widthOfString(texto, { width: 200 }) + 12
  doc.roundedRect(x, y, largura, 16, 3).fill(fundo)
  doc.fillColor(cor).fontSize(8).text(texto, x + 6, y + 4, { width: largura - 12 })
  return largura
}

function tentarDesenharFoto(doc: PDFKit.PDFDocument, fotoUrl: string | null | undefined, x: number, y: number): void {
  if (!fotoUrl) return
  const caminho = caminhoAbsolutoPorUrlPublica(fotoUrl)
  if (!caminho) return
  try {
    const buffer = readFileSync(caminho)
    doc.image(buffer, x, y, { fit: [26, 26] })
  } catch {
    // Arquivo de foto ausente/ilegível — segue sem imagem, não interrompe o PDF.
  }
}

export async function gerarPdfRelatorioConferencia(
  relatorio: RelatorioConferenciaArquivo,
  contexto: {
    numeroPedido: number
    nomeArquivo: string
    statusConferencia?: StatusConferenciaAnexo
    motivoAjuste?: string | null
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const partes: Buffer[] = []
    doc.on('data', (chunk: Buffer) => partes.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(partes)))
    doc.on('error', reject)

    const larguraUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right

    doc.fontSize(16).fillColor(COR_TEXTO).text(`Conferência por IA — Pedido #${contexto.numeroPedido}`)
    doc.fontSize(10).fillColor(COR_TEXTO_FRACO).text(`Documento: ${contexto.nomeArquivo}`)
    doc.moveDown(0.6)

    doc
      .fontSize(11)
      .fillColor(COR_TEXTO)
      .text(`Status geral: ${ROTULO_STATUS_GERAL[relatorio.statusGeral]}`)
    doc.fontSize(9).fillColor(COR_TEXTO_FRACO).text(`Provedor: ${relatorio.provider} (${relatorio.modelo})`)
    doc.moveDown(0.6)

    // KPIs em caixas coloridas, lado a lado.
    const kpis: { rotulo: string; valor: number; cor: string }[] = [
      { rotulo: 'Itens no pedido', valor: relatorio.resumo.totalItensPedido, cor: COR_TEXTO },
      { rotulo: 'Itens no arquivo', valor: relatorio.resumo.totalItensArquivo, cor: COR_TEXTO },
      { rotulo: 'OK', valor: relatorio.resumo.ok, cor: COR_OK },
      { rotulo: 'Divergentes', valor: relatorio.resumo.divergentes, cor: COR_ALERTA },
      {
        rotulo: 'Sem match / sobra',
        valor: relatorio.resumo.semMatch + relatorio.resumo.sobrasArquivo,
        cor: COR_ALERTA,
      },
    ]
    const larguraKpi = larguraUtil / kpis.length - 6
    let xKpi = doc.page.margins.left
    const yKpi = doc.y
    kpis.forEach((kpi) => {
      doc.roundedRect(xKpi, yKpi, larguraKpi, 42, 4).stroke(COR_BORDA)
      doc.fontSize(14).fillColor(kpi.cor).text(String(kpi.valor), xKpi, yKpi + 6, { width: larguraKpi, align: 'center' })
      doc.fontSize(7).fillColor(COR_TEXTO_FRACO).text(kpi.rotulo, xKpi + 2, yKpi + 26, {
        width: larguraKpi - 4,
        align: 'center',
      })
      xKpi += larguraKpi + 6
    })
    doc.y = yKpi + 42
    doc.moveDown(0.8)

    // Decisão do comprador.
    if (contexto.statusConferencia) {
      const decisao = ROTULO_STATUS_DECISAO[contexto.statusConferencia]
      doc.fontSize(10).fillColor(COR_TEXTO).text('Decisão do comprador', doc.page.margins.left, doc.y, {
        continued: false,
      })
      const ySelo = doc.y + 2
      desenharSelo(doc, decisao.texto, doc.page.margins.left, ySelo, decisao.cor, decisao.fundo)
      doc.y = ySelo + 20

      if (contexto.statusConferencia === 'ajuste_solicitado' && contexto.motivoAjuste) {
        const yCaixa = doc.y
        const alturaCaixa = doc.heightOfString(`Motivo do ajuste: ${contexto.motivoAjuste}`, {
          width: larguraUtil - 16,
        }) + 12
        doc.roundedRect(doc.page.margins.left, yCaixa, larguraUtil, alturaCaixa, 4).fill(COR_ERRO_FUNDO)
        doc
          .fillColor(COR_ERRO)
          .fontSize(9)
          .text(`Motivo do ajuste: ${contexto.motivoAjuste}`, doc.page.margins.left + 8, yCaixa + 6, {
            width: larguraUtil - 16,
          })
        doc.y = yCaixa + alturaCaixa + 6
      }
      doc.moveDown(0.4)
    }

    if (relatorio.avisos.length > 0) {
      relatorio.avisos.forEach((aviso) => {
        const y = doc.y
        const altura = doc.heightOfString(aviso, { width: larguraUtil - 16 }) + 10
        doc.roundedRect(doc.page.margins.left, y, larguraUtil, altura, 3).fill(COR_ALERTA_FUNDO)
        doc.fillColor(COR_ALERTA).fontSize(9).text(aviso, doc.page.margins.left + 8, y + 5, {
          width: larguraUtil - 16,
        })
        doc.y = y + altura + 4
      })
      doc.moveDown(0.3)
    }

    if (relatorio.cabecalho.divergencias.length > 0) {
      doc.fontSize(11).fillColor(COR_TEXTO).text('Divergências do cabeçalho')
      doc.moveDown(0.2)
      relatorio.cabecalho.divergencias.forEach((d) => {
        doc
          .fontSize(9)
          .fillColor(COR_TEXTO_FRACO)
          .text(`•  ${d.campo}: esperado "${d.esperado}" · encontrado "${d.encontrado}"`)
      })
      doc.moveDown(0.5)
    }

    doc.fontSize(11).fillColor(COR_TEXTO).text('Itens')
    doc.moveDown(0.3)

    // Tabela: Foto | Status | Método | Pedido | Arquivo | Divergências
    const colFoto = 30
    const colStatus = 70
    const colMetodo = 80
    const colDivergencias = 150
    const colPedido = (larguraUtil - colFoto - colStatus - colMetodo - colDivergencias) / 2
    const colArquivo = colPedido

    function cabecalhoTabela(): void {
      const y = doc.y
      doc.rect(doc.page.margins.left, y, larguraUtil, 18).fill(COR_NEUTRO_FUNDO)
      let x = doc.page.margins.left + 4
      doc.fillColor(COR_TEXTO_FRACO).fontSize(7.5)
      doc.text('FOTO', x, y + 5, { width: colFoto })
      x += colFoto
      doc.text('STATUS', x, y + 5, { width: colStatus })
      x += colStatus
      doc.text('MÉTODO', x, y + 5, { width: colMetodo })
      x += colMetodo
      doc.text('PEDIDO', x, y + 5, { width: colPedido })
      x += colPedido
      doc.text('ARQUIVO', x, y + 5, { width: colArquivo })
      x += colArquivo
      doc.text('DIVERGÊNCIAS', x, y + 5, { width: colDivergencias })
      doc.y = y + 18
    }

    cabecalhoTabela()

    relatorio.linhas.forEach((linha) => {
      const textoPedido = linha.pedido
        ? `${linha.pedido.nome}\n${linha.pedido.quantidade} × R$ ${linha.pedido.precoUnitario.toFixed(2)}`
        : '—'
      const textoArquivo = linha.arquivo
        ? `${linha.arquivo.descricao}\n${linha.arquivo.quantidade} × R$ ${linha.arquivo.precoUnitario.toFixed(2)}`
        : '—'
      const textoDiv = textoDivergencias(linha.divergencias)

      const alturaLinha = Math.max(
        30,
        doc.heightOfString(textoPedido, { width: colPedido - 4 }) + 8,
        doc.heightOfString(textoArquivo, { width: colArquivo - 4 }) + 8,
        doc.heightOfString(textoDiv, { width: colDivergencias - 4 }) + 8
      )

      if (doc.y + alturaLinha > doc.page.height - doc.page.margins.bottom) {
        doc.addPage()
        cabecalhoTabela()
      }

      const y = doc.y
      doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + larguraUtil, y).stroke(COR_BORDA)

      let x = doc.page.margins.left + 4
      tentarDesenharFoto(doc, linha.pedido?.fotoUrl, x, y + 3)
      x += colFoto

      const rotuloStatus = ROTULO_STATUS_LINHA[linha.status]
      desenharSelo(doc, rotuloStatus.texto, x, y + 4, rotuloStatus.cor, rotuloStatus.fundo)
      x += colStatus

      doc.fillColor(COR_TEXTO_FRACO).fontSize(8).text(ROTULO_METODO[linha.metodoMatch], x, y + 6, { width: colMetodo - 4 })
      x += colMetodo

      doc.fillColor(COR_TEXTO).fontSize(8).text(textoPedido, x, y + 6, { width: colPedido - 4 })
      x += colPedido

      doc.fillColor(COR_TEXTO).fontSize(8).text(textoArquivo, x, y + 6, { width: colArquivo - 4 })
      x += colArquivo

      doc.fillColor(COR_TEXTO_FRACO).fontSize(7.5).text(textoDiv, x, y + 6, { width: colDivergencias - 4 })

      doc.y = y + alturaLinha
    })

    doc.end()
  })
}
