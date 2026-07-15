/**
 * Salva no disco os documentos enviados pelo fornecedor no portal (PDF/XLSX/XLS/CSV).
 * Segue o mesmo padrão de src/modulos/produtos/armazenamento-foto-produto.ts.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

const PASTA_BASE = 'portal-fornecedor'
const PASTA_UPLOADS = path.join(process.cwd(), 'uploads', PASTA_BASE)

const EXTENSAO_POR_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'text/csv': '.csv',
}

export function pastaDoPedido(pedidoCompraId: string): string {
  return path.join(PASTA_UPLOADS, pedidoCompraId)
}

function extrairBufferDeBase64(base64: string): Buffer {
  const semPrefixo = base64.includes(',') ? base64.split(',')[1] : base64
  return Buffer.from(semPrefixo, 'base64')
}

export async function salvarAnexoFornecedor(
  pedidoCompraId: string,
  mimeType: string,
  base64Arquivo: string
): Promise<{ caminhoArquivo: string; tamanhoBytes: number }> {
  const extensao = EXTENSAO_POR_MIME[mimeType]
  if (!extensao) {
    throw new ErroDaAplicacao('Tipo de arquivo não suportado', 400)
  }

  const pasta = pastaDoPedido(pedidoCompraId)
  await mkdir(pasta, { recursive: true })

  const buffer = extrairBufferDeBase64(base64Arquivo)
  const nomeNoDisco = `${randomUUID()}${extensao}`
  await writeFile(path.join(pasta, nomeNoDisco), buffer)

  return {
    caminhoArquivo: path.join(PASTA_BASE, pedidoCompraId, nomeNoDisco),
    tamanhoBytes: buffer.length,
  }
}

export function caminhoAbsolutoAnexo(caminhoRelativo: string): string {
  return path.join(process.cwd(), 'uploads', caminhoRelativo)
}

export async function removerPastaAnexosDoPedido(pedidoCompraId: string): Promise<void> {
  await rm(pastaDoPedido(pedidoCompraId), { recursive: true, force: true })
}
