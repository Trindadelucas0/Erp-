/**
 * Cache em disco do PDF DANFE (NFe) / DANFSe (NFS-e).
 * Path relativo gravado em NfeRecebida.danfeCaminho.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PASTA_RAIZ = path.join(process.cwd(), 'uploads', 'nfe-recebidas')

export function caminhoRelativoDanfe(companyId: string, notaId: string): string {
  return `uploads/nfe-recebidas/${companyId}/${notaId}.pdf`
}

export function caminhoAbsolutoDanfe(companyId: string, notaId: string): string {
  return path.join(PASTA_RAIZ, companyId, `${notaId}.pdf`)
}

export function caminhoAbsolutoPorRelativo(relativo: string): string {
  return path.join(process.cwd(), relativo.replace(/^\//, ''))
}

export async function danfeExiste(companyId: string, notaId: string): Promise<boolean> {
  try {
    await access(caminhoAbsolutoDanfe(companyId, notaId))
    return true
  } catch {
    return false
  }
}

export async function danfeExistePorCaminho(relativo: string | null | undefined): Promise<boolean> {
  if (!relativo) return false
  try {
    await access(caminhoAbsolutoPorRelativo(relativo))
    return true
  } catch {
    return false
  }
}

export async function salvarDanfe(
  companyId: string,
  notaId: string,
  pdf: Buffer
): Promise<string> {
  const pasta = path.join(PASTA_RAIZ, companyId)
  await mkdir(pasta, { recursive: true })
  const absoluto = caminhoAbsolutoDanfe(companyId, notaId)
  await writeFile(absoluto, pdf)
  return caminhoRelativoDanfe(companyId, notaId)
}

export async function lerDanfe(companyId: string, notaId: string): Promise<Buffer | null> {
  try {
    return await readFile(caminhoAbsolutoDanfe(companyId, notaId))
  } catch {
    return null
  }
}

export async function lerDanfePorCaminho(relativo: string): Promise<Buffer | null> {
  try {
    return await readFile(caminhoAbsolutoPorRelativo(relativo))
  } catch {
    return null
  }
}
