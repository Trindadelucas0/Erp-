/**
 * Parser do ODS Santri (relatório Relação de Produtos).
 * Extrai content.xml do zip e lê células da tabela.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { COLUNAS_SANTRI, type ProdutoSantriBruto } from './tipos.js'

function extrairContentXml(caminhoOds: string): string {
  const destino = path.join(tmpdir(), `santri-ods-${Date.now()}`)
  mkdirSync(destino, { recursive: true })
  try {
    if (process.platform === 'win32') {
      execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${caminhoOds.replace(/'/g, "''")}' -DestinationPath '${destino.replace(/'/g, "''")}' -Force`,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      )
    } else {
      execFileSync('unzip', ['-o', '-q', caminhoOds, '-d', destino], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    }
    const contentPath = path.join(destino, 'content.xml')
    if (!existsSync(contentPath)) {
      throw new Error('Arquivo ODS inválido: content.xml não encontrado')
    }
    return readFileSync(contentPath, 'utf8')
  } finally {
    rmSync(destino, { recursive: true, force: true })
  }
}

function textoCelula(xmlCelula: string): string {
  const partes: string[] = []
  const re = new RegExp(`<text:p(?:\\s[^>]*)?>([\\s\\S]*?)</text:p>`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(xmlCelula))) {
    const bruto = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
    partes.push(bruto)
  }
  return partes.join(' | ').trim()
}

function atr(xml: string, nomeLocal: string): string | undefined {
  const re = new RegExp(
    `(?:${nomeLocal}|table:${nomeLocal})="([^"]*)"`,
    'i'
  )
  const m = xml.match(re)
  return m?.[1]
}

/** Expande células de uma linha ODS (respeita number-columns-repeated). */
export function expandirCelulasLinha(xmlLinha: string): string[] {
  const celulas: string[] = []
  const reCelula =
    /<(table:table-cell|table:covered-table-cell)([^>]*)(?:\/>|>([\s\S]*?)<\/\1>)/g
  let m: RegExpExecArray | null
  while ((m = reCelula.exec(xmlLinha))) {
    const tag = m[1]
    const attrs = m[2] ?? ''
    const corpo = m[3] ?? ''
    const rptRaw = atr(attrs, 'number-columns-repeated')
    const n = Math.min(Number(rptRaw || '1') || 1, 80)
    if (tag.includes('covered-table-cell')) {
      for (let i = 0; i < n; i++) celulas.push('')
      continue
    }
    const txt = textoCelula(corpo)
    for (let i = 0; i < n; i++) celulas.push(txt)
  }
  return celulas
}

function ehCodigoProduto(codigo: string, nome: string): boolean {
  return Boolean(nome.trim() && /^[\d.]+$/.test(codigo.trim()))
}

function mapearLinha(celulas: string[], linha: number): ProdutoSantriBruto {
  const g = (i: number) => (celulas[i] ?? '').trim()
  return {
    linha,
    codigo: g(COLUNAS_SANTRI.codigo),
    nome: g(COLUNAS_SANTRI.nome),
    ncm: g(COLUNAS_SANTRI.ncm),
    nomeCompra: g(COLUNAS_SANTRI.nomeCompra),
    fabricante: g(COLUNAS_SANTRI.fabricante),
    marca: g(COLUNAS_SANTRI.marca),
    ativo: g(COLUNAS_SANTRI.ativo),
    undVenda: g(COLUNAS_SANTRI.undVenda),
    undCompra: g(COLUNAS_SANTRI.undCompra),
    tipoControleEstoque: g(COLUNAS_SANTRI.tipoControleEstoque),
    aceitaEstoqueNegativo: g(COLUNAS_SANTRI.aceitaEstoqueNegativo),
    codigoOriginal: g(COLUNAS_SANTRI.codigoOriginal),
    codigoBarras: g(COLUNAS_SANTRI.codigoBarras),
    bloqueadoCompras: g(COLUNAS_SANTRI.bloqueadoCompras),
    estoque: g(COLUNAS_SANTRI.estoque),
    preco: g(COLUNAS_SANTRI.preco),
    multiploVenda: g(COLUNAS_SANTRI.multiploVenda),
    multiploCompraUnitario: g(COLUNAS_SANTRI.multiploCompraUnitario),
    multiploCompraSecundario: g(COLUNAS_SANTRI.multiploCompraSecundario),
    undEntrega: g(COLUNAS_SANTRI.undEntrega),
    prontaEntrega: g(COLUNAS_SANTRI.prontaEntrega),
    kit: g(COLUNAS_SANTRI.kit),
    pesoUnidade: g(COLUNAS_SANTRI.pesoUnidade),
    alturaUnidade: g(COLUNAS_SANTRI.alturaUnidade),
    larguraUnidade: g(COLUNAS_SANTRI.larguraUnidade),
    comprimentoUnidade: g(COLUNAS_SANTRI.comprimentoUnidade),
    pesoCaixa: g(COLUNAS_SANTRI.pesoCaixa),
    alturaCaixa: g(COLUNAS_SANTRI.alturaCaixa),
    larguraCaixa: g(COLUNAS_SANTRI.larguraCaixa),
    comprimentoCaixa: g(COLUNAS_SANTRI.comprimentoCaixa),
    capacidadeEmpilhamento: g(COLUNAS_SANTRI.capacidadeEmpilhamento),
    origem: g(COLUNAS_SANTRI.origem),
  }
}

/**
 * Lê o ODS Santri e retorna só linhas de produto (ignora cabeçalho/rodapé).
 */
export function parsearOdsProdutosSantri(caminhoOds: string): ProdutoSantriBruto[] {
  if (!existsSync(caminhoOds)) {
    throw new Error(`Arquivo não encontrado: ${caminhoOds}`)
  }

  const xml = extrairContentXml(caminhoOds)
  const produtos: ProdutoSantriBruto[] = []

  // Cabeçalho fica na 5ª linha de dados (índice 4); produtos a partir da 5.
  const reLinha = /<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/g
  let idx = 0
  let m: RegExpExecArray | null
  while ((m = reLinha.exec(xml))) {
    const celulas = expandirCelulasLinha(m[1])
    if (idx >= 5) {
      const bruto = mapearLinha(celulas, idx + 1)
      if (ehCodigoProduto(bruto.codigo, bruto.nome)) {
        produtos.push(bruto)
      }
    }
    idx += 1
  }

  return produtos
}
