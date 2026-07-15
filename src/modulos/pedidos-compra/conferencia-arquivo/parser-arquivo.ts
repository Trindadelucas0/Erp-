/**
 * Parser determinístico de Excel/CSV do fornecedor. PDF não entra aqui —
 * vai direto para o extrator de IA (texto sem estrutura de coluna confiável).
 */
import ExcelJS from 'exceljs'
import type { ItemExtraido } from './tipos-conferencia.js'

export type TipoArquivoConferencia = 'pdf' | 'excel' | 'csv' | 'desconhecido'

const MIME_EXCEL = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
])

export function detectarTipoArquivo(mimeType: string): TipoArquivoConferencia {
  if (mimeType === 'application/pdf') return 'pdf'
  if (MIME_EXCEL.has(mimeType)) return 'excel'
  if (mimeType === 'text/csv') return 'csv'
  return 'desconhecido'
}

export async function extrairLinhasDeTabela(
  buffer: Buffer,
  tipo: 'excel' | 'csv'
): Promise<string[][]> {
  if (tipo === 'csv') {
    const texto = buffer.toString('utf8')
    return texto
      .split(/\r?\n/)
      .filter((linha) => linha.trim().length > 0)
      .map((linha) => linha.split(/[;,]/).map((celula) => celula.trim().replace(/^"|"$/g, '')))
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  const planilha = workbook.worksheets[0]
  const linhas: string[][] = []
  planilha?.eachRow((row) => {
    const celulas = row.values as (string | number | null)[]
    linhas.push(celulas.slice(1).map((c) => (c == null ? '' : String(c).trim())))
  })
  return linhas
}

const PALAVRAS_CODIGO = ['codigo', 'cod', 'sku', 'referencia', 'ref']
const PALAVRAS_DESCRICAO = ['descricao', 'produto', 'item', 'discriminacao']
const PALAVRAS_QUANTIDADE = ['quantidade', 'qtd', 'qtde', 'quant']
const PALAVRAS_PRECO = ['preco unit', 'preço unit', 'valor unit', 'vl unit', 'unitario', 'unitário', 'preco', 'preço']
const PALAVRAS_UNIDADE = ['unidade', 'und', 'un']
const PALAVRAS_TOTAL = ['total', 'vl total']

function normalizarCabecalho(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function encontrarIndiceColuna(cabecalho: string[], palavras: string[]): number {
  return cabecalho.findIndex((c) => palavras.some((p) => c.includes(p)))
}

function converterNumeroBr(valor: string | undefined): number | null {
  if (!valor) return null
  const limpo = valor
    .trim()
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const numero = Number(limpo)
  return Number.isFinite(numero) ? numero : null
}

export function mapearLinhasParaItens(linhas: string[][]): { itens: ItemExtraido[]; avisos: string[] } {
  const avisos: string[] = []

  const indiceCabecalho = linhas.findIndex((linha) => {
    const normalizada = linha.map(normalizarCabecalho)
    return (
      encontrarIndiceColuna(normalizada, PALAVRAS_DESCRICAO) >= 0 &&
      encontrarIndiceColuna(normalizada, PALAVRAS_QUANTIDADE) >= 0
    )
  })

  if (indiceCabecalho === -1) {
    avisos.push('Não foi possível identificar as colunas da tabela no arquivo (cabeçalho não reconhecido).')
    return { itens: [], avisos }
  }

  const cabecalho = linhas[indiceCabecalho].map(normalizarCabecalho)
  const idxCodigo = encontrarIndiceColuna(cabecalho, PALAVRAS_CODIGO)
  const idxDescricao = encontrarIndiceColuna(cabecalho, PALAVRAS_DESCRICAO)
  const idxQuantidade = encontrarIndiceColuna(cabecalho, PALAVRAS_QUANTIDADE)
  const idxPreco = encontrarIndiceColuna(cabecalho, PALAVRAS_PRECO)
  const idxUnidade = encontrarIndiceColuna(cabecalho, PALAVRAS_UNIDADE)
  const idxTotal = encontrarIndiceColuna(cabecalho, PALAVRAS_TOTAL)

  const itens: ItemExtraido[] = []
  for (const linha of linhas.slice(indiceCabecalho + 1)) {
    const descricao = (linha[idxDescricao] ?? '').trim()
    if (!descricao) continue

    const quantidade = converterNumeroBr(linha[idxQuantidade])
    const precoUnitario = idxPreco >= 0 ? converterNumeroBr(linha[idxPreco]) : null

    if (quantidade == null || precoUnitario == null) {
      avisos.push(`Linha ignorada por dado numérico inválido: "${descricao}"`)
      continue
    }

    itens.push({
      codigo: idxCodigo >= 0 ? linha[idxCodigo] || null : null,
      codigoBarras: null,
      ncm: null,
      descricao,
      unidade: idxUnidade >= 0 ? linha[idxUnidade] || null : null,
      quantidade,
      precoUnitario,
      precoUnitarioComImposto: null,
      valorTotalItem: idxTotal >= 0 ? converterNumeroBr(linha[idxTotal]) : null,
    })
  }

  return { itens, avisos }
}
