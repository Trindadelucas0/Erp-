/**
 * Servir arquivos de upload (fotos de produtos).
 */
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { caminhoAbsolutoFoto } from '../../modulos/produtos/armazenamento-foto-produto.js'

const MIME_POR_EXTENSAO: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

async function servirArquivoUpload(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { companyId, produtoId, arquivo } = requisicao.params as {
    companyId: string
    produtoId: string
    arquivo: string
  }

  if (arquivo.includes('..') || arquivo.includes('/') || arquivo.includes('\\')) {
    throw new ErroDaAplicacao('Arquivo inválido', 400)
  }

  const caminho = caminhoAbsolutoFoto(companyId, produtoId, arquivo)
  const raizUploads = path.join(process.cwd(), 'uploads', 'produtos')
  const caminhoResolvido = path.resolve(caminho)

  if (!caminhoResolvido.startsWith(path.resolve(raizUploads))) {
    throw new ErroDaAplicacao('Caminho inválido', 400)
  }

  try {
    const buffer = await readFile(caminhoResolvido)
    const ext = path.extname(arquivo).toLowerCase()
    const mime = MIME_POR_EXTENSAO[ext] ?? 'application/octet-stream'
    return resposta.type(mime).send(buffer)
  } catch {
    throw new ErroDaAplicacao('Arquivo não encontrado', 404)
  }
}

export async function rotasDeUploads(aplicacao: FastifyInstance): Promise<void> {
  aplicacao.get(
    '/produtos/:companyId/:produtoId/:arquivo',
    servirArquivoUpload
  )
}
