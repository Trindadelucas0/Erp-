/**
 * Anexos de Entrada de Notas (ressalva assinada da divergência de contagem), máx. 2 MB.
 * Mesmo padrão de armazenamento-anexo-conta-pagar.ts.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

export const TAMANHO_MAX_ANEXO_ENTRADA_NOTA_BYTES = 2 * 1024 * 1024

const PASTA_BASE = 'entrada-notas'
const PASTA_UPLOADS = path.join(process.cwd(), 'uploads', PASTA_BASE)

export const MIMES_ANEXO_ENTRADA_NOTA: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export function pastaDaNota(notaId: string): string {
  return path.join(PASTA_UPLOADS, notaId)
}

function extrairBufferDeBase64(base64: string): Buffer {
  const semPrefixo = base64.includes(',') ? base64.split(',')[1] : base64
  return Buffer.from(semPrefixo, 'base64')
}

export async function salvarAnexoEntradaNota(
  notaId: string,
  mimeType: string,
  base64Arquivo: string
): Promise<{ caminhoArquivo: string; tamanhoBytes: number }> {
  const mime = mimeType.toLowerCase().trim()
  const extensao = MIMES_ANEXO_ENTRADA_NOTA[mime]
  if (!extensao) {
    throw new ErroDaAplicacao(
      'Tipo de arquivo não suportado. Use PDF, JPG, PNG ou WEBP.',
      400
    )
  }

  const buffer = extrairBufferDeBase64(base64Arquivo)
  if (buffer.length <= 0) {
    throw new ErroDaAplicacao('Arquivo vazio', 400)
  }
  if (buffer.length > TAMANHO_MAX_ANEXO_ENTRADA_NOTA_BYTES) {
    throw new ErroDaAplicacao('Arquivo não pode ser superior a 2 MB', 400)
  }

  const pasta = pastaDaNota(notaId)
  await mkdir(pasta, { recursive: true })

  const nomeNoDisco = `${randomUUID()}${extensao}`
  await writeFile(path.join(pasta, nomeNoDisco), buffer)

  return {
    caminhoArquivo: [PASTA_BASE, notaId, nomeNoDisco].join('/'),
    tamanhoBytes: buffer.length,
  }
}

export function caminhoAbsolutoAnexoEntradaNota(caminhoRelativo: string): string {
  const normalizado = caminhoRelativo.replace(/\\/g, '/')
  return path.join(process.cwd(), 'uploads', ...normalizado.split('/').filter(Boolean))
}

export async function removerAnexoEntradaNota(caminhoRelativo: string): Promise<void> {
  await rm(caminhoAbsolutoAnexoEntradaNota(caminhoRelativo), { force: true })
}
