import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

const MAX_BYTES = 2 * 1024 * 1024
const MIMES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export async function salvarAnexoOrcamento(
  orcamentoId: string,
  mimeType: string,
  base64Arquivo: string
) {
  const extensao = MIMES[mimeType.toLowerCase()]
  if (!extensao) throw new ErroDaAplicacao('Tipo de arquivo não suportado', 400)
  const conteudo = base64Arquivo.includes(',') ? base64Arquivo.split(',')[1] : base64Arquivo
  const buffer = Buffer.from(conteudo, 'base64')
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    throw new ErroDaAplicacao('Arquivo deve ter até 2 MB', 400)
  }
  const pasta = path.join(process.cwd(), 'uploads', 'orcamentos', orcamentoId)
  await mkdir(pasta, { recursive: true })
  const nome = `${randomUUID()}${extensao}`
  await writeFile(path.join(pasta, nome), buffer)
  return {
    caminhoArquivo: ['orcamentos', orcamentoId, nome].join('/'),
    tamanhoBytes: buffer.length,
  }
}

export function caminhoAbsolutoAnexoOrcamento(caminhoArquivo: string) {
  return path.join(process.cwd(), 'uploads', ...caminhoArquivo.split('/').filter(Boolean))
}

export async function removerAnexoOrcamento(caminhoArquivo: string) {
  await rm(caminhoAbsolutoAnexoOrcamento(caminhoArquivo), { force: true })
}
