/**
 * Salva e remove fotos de produto no disco.
 */
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises'
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

export async function copiarFotosDeProduto(
  companyId: string,
  origemId: string,
  destinoId: string,
  arquivos: { principal: string; miniatura: string }
): Promise<{ tamanhoPrincipal: number; tamanhoMiniatura: number }> {
  const pastaOrigem = pastaDoProduto(companyId, origemId)
  const pastaDestino = pastaDoProduto(companyId, destinoId)
  await mkdir(pastaDestino, { recursive: true })

  const caminhoPrincipalOrigem = path.join(pastaOrigem, arquivos.principal)
  const caminhoMiniaturaOrigem = path.join(pastaOrigem, arquivos.miniatura)
  const caminhoPrincipalDestino = path.join(pastaDestino, arquivos.principal)
  const caminhoMiniaturaDestino = path.join(pastaDestino, arquivos.miniatura)

  await copyFile(caminhoPrincipalOrigem, caminhoPrincipalDestino)
  await copyFile(caminhoMiniaturaOrigem, caminhoMiniaturaDestino)

  const statPrincipal = await stat(caminhoPrincipalDestino)
  const statMiniatura = await stat(caminhoMiniaturaDestino)

  return {
    tamanhoPrincipal: statPrincipal.size,
    tamanhoMiniatura: statMiniatura.size,
  }
}
