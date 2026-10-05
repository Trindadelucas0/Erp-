import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

export const TAMANHO_MAX_CERTIFICADO_BYTES = 2 * 1024 * 1024

const PASTA_BASE = 'parametros-boleto'
const PASTA_UPLOADS = path.join(process.cwd(), 'uploads', PASTA_BASE)

export const EXTENSOES_CERTIFICADO: Record<string, string> = {
  'application/x-pem-file': '.pem',
  'application/pem-certificate-chain': '.pem',
  'application/x-x509-ca-cert': '.crt',
  'application/pkix-cert': '.cer',
  'application/x-pkcs12': '.p12',
  'application/pkcs12': '.p12',
  'application/octet-stream': '.pfx',
}

const EXTENSOES_POR_NOME: Record<string, string> = {
  '.pem': '.pem',
  '.crt': '.crt',
  '.cer': '.cer',
  '.pfx': '.pfx',
  '.p12': '.p12',
}

function extrairBufferDeBase64(base64: string): Buffer {
  const semPrefixo = base64.includes(',') ? base64.split(',')[1] : base64
  return Buffer.from(semPrefixo, 'base64')
}

function resolverExtensao(mimeType: string, nomeArquivo?: string | null): string | null {
  const mime = mimeType.toLowerCase().trim()
  const porMime = EXTENSOES_CERTIFICADO[mime]
  if (porMime) return porMime
  if (nomeArquivo) {
    const ext = path.extname(nomeArquivo).toLowerCase()
    return EXTENSOES_POR_NOME[ext] ?? null
  }
  return null
}

export function pastaDoParametro(companyId: string, parametroId: string): string {
  return path.join(PASTA_UPLOADS, companyId, parametroId)
}

export async function salvarCertificadoBoleto(
  companyId: string,
  parametroId: string,
  mimeType: string,
  base64Arquivo: string,
  nomeArquivo?: string | null
): Promise<{ caminhoArquivo: string; tamanhoBytes: number; nomeExibicao: string }> {
  const extensao = resolverExtensao(mimeType, nomeArquivo)
  if (!extensao) {
    throw new ErroDaAplicacao(
      'Tipo de arquivo não suportado. Use PEM, CRT, CER, PFX ou P12.',
      400
    )
  }

  const buffer = extrairBufferDeBase64(base64Arquivo)
  if (buffer.length <= 0) {
    throw new ErroDaAplicacao('Arquivo vazio', 400)
  }
  if (buffer.length > TAMANHO_MAX_CERTIFICADO_BYTES) {
    throw new ErroDaAplicacao('Arquivo não pode ser superior a 2 MB', 400)
  }

  const pasta = pastaDoParametro(companyId, parametroId)
  await mkdir(pasta, { recursive: true })

  const nomeNoDisco = `${randomUUID()}${extensao}`
  await writeFile(path.join(pasta, nomeNoDisco), buffer)

  const nomeExibicao =
    nomeArquivo?.trim() && !nomeArquivo.includes('..')
      ? path.basename(nomeArquivo.trim())
      : nomeNoDisco

  return {
    caminhoArquivo: [PASTA_BASE, companyId, parametroId, nomeNoDisco].join('/'),
    tamanhoBytes: buffer.length,
    nomeExibicao,
  }
}

export function caminhoAbsolutoCertificado(caminhoRelativo: string): string {
  const normalizado = caminhoRelativo.replace(/\\/g, '/')
  return path.join(process.cwd(), 'uploads', ...normalizado.split('/').filter(Boolean))
}

export async function removerCertificadoBoleto(caminhoRelativo: string | null | undefined): Promise<void> {
  if (!caminhoRelativo) return
  await rm(caminhoAbsolutoCertificado(caminhoRelativo), { force: true })
}
