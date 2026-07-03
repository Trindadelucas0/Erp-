/**
 * Salva e remove fotos de produto no disco.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'

const PASTA_UPLOADS = path.join(process.cwd(), 'uploads', 'produtos')

export function pastaDoProduto(companyId: string, produtoId: string): string {
  return path.join(PASTA_UPLOADS, companyId, produtoId)
}

export function urlPublicaFoto(
  companyId: string,
  produtoId: string,
  arquivo: string
): string {
  return `/uploads/produtos/${companyId}/${produtoId}/${arquivo}`
}

function extrairBufferDeDataUrl(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/)
  if (!match) {
    throw new Error('Formato de imagem inválido')
  }
  return Buffer.from(match[1], 'base64')
}

export async function salvarFotosProduto(
  companyId: string,
  produtoId: string,
  principalDataUrl: string,
  miniaturaDataUrl: string
): Promise<{ principal: string; miniatura: string; tamanhoPrincipal: number; tamanhoMiniatura: number }> {
  const pasta = pastaDoProduto(companyId, produtoId)
  await mkdir(pasta, { recursive: true })

  const bufferPrincipal = extrairBufferDeDataUrl(principalDataUrl)
  const bufferMiniatura = extrairBufferDeDataUrl(miniaturaDataUrl)

  const arquivoPrincipal = 'principal.jpg'
  const arquivoMiniatura = 'miniatura.jpg'

  await writeFile(path.join(pasta, arquivoPrincipal), bufferPrincipal)
  await writeFile(path.join(pasta, arquivoMiniatura), bufferMiniatura)

  return {
    principal: arquivoPrincipal,
    miniatura: arquivoMiniatura,
    tamanhoPrincipal: bufferPrincipal.length,
    tamanhoMiniatura: bufferMiniatura.length,
  }
}

export async function removerPastaFotosProduto(
  companyId: string,
  produtoId: string
): Promise<void> {
  const pasta = pastaDoProduto(companyId, produtoId)
  await rm(pasta, { recursive: true, force: true })
}

export function caminhoAbsolutoFoto(
  companyId: string,
  produtoId: string,
  arquivo: string
): string {
  return path.join(pastaDoProduto(companyId, produtoId), arquivo)
}
