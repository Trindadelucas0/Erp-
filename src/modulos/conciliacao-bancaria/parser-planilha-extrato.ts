import ExcelJS from 'exceljs'
import type { LinhaExtratoImportada } from './parser-ofx.js'

const CABECALHO = ['data', 'historico', 'documento', 'valor']

function normalizar(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function numeroBr(valor: string): number | null {
  const numero = Number(valor.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(numero) && numero !== 0 ? numero : null
}

function dataBr(valor: string): Date | null {
  const br = valor.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const iso = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const partes = br ? [br[3], br[2], br[1]] : iso ? [iso[1], iso[2], iso[3]] : null
  if (!partes) return null
  const data = new Date(`${partes[0]}-${partes[1]}-${partes[2]}T00:00:00.000Z`)
  return Number.isNaN(data.getTime()) ? null : data
}

async function extrairLinhas(buffer: Buffer, tipo: 'csv' | 'excel'): Promise<string[][]> {
  if (tipo === 'csv') {
    return buffer
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter((linha) => linha.trim())
      .map((linha) => linha.split(';').map((celula) => celula.trim().replace(/^"|"$/g, '')))
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  const linhas: string[][] = []
  workbook.worksheets[0]?.eachRow((row) => {
    const celulas = row.values as Array<string | number | Date | null>
    linhas.push(celulas.slice(1).map((valor) => {
      if (valor instanceof Date) return valor.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      return valor == null ? '' : String(valor).trim()
    }))
  })
  return linhas
}

export async function parsearPlanilhaExtrato(
  buffer: Buffer,
  tipo: 'csv' | 'excel'
): Promise<{ linhas: LinhaExtratoImportada[]; invalidas: number }> {
  const tabela = await extrairLinhas(buffer, tipo)
  const cabecalho = (tabela[0] ?? []).map(normalizar)
  if (CABECALHO.some((nome, indice) => cabecalho[indice] !== nome)) {
    throw new Error('Cabeçalho inválido. Use Data;Histórico;Documento;Valor.')
  }

  const linhas: LinhaExtratoImportada[] = []
  let invalidas = 0
  for (const linha of tabela.slice(1)) {
    const data = dataBr(linha[0] ?? '')
    const valor = numeroBr(linha[3] ?? '')
    const historico = (linha[1] ?? '').trim()
    if (!data || valor == null || !historico) {
      invalidas += 1
      continue
    }
    linhas.push({
      data,
      historico,
      documento: (linha[2] ?? '').trim() || null,
      valor,
      identificador: null,
    })
  }
  return { linhas, invalidas }
}

export const MODELO_CSV_EXTRATO =
  'Data;Histórico;Documento;Valor\r\n01/10/2026;Tarifa bancária;TAR 001;-42,00\r\n'
