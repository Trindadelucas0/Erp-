export const MIME_TIPOS_ANEXO_FORNECEDOR = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
] as const

export type MimeTipoAnexoFornecedor = (typeof MIME_TIPOS_ANEXO_FORNECEDOR)[number]

const EXTENSAO_POR_MIME: Record<MimeTipoAnexoFornecedor, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'text/csv': '.csv',
}

const MIME_POR_EXTENSAO: Record<string, MimeTipoAnexoFornecedor> = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
}

export const ACCEPT_ANEXO_FORNECEDOR =
  '.pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

export const MENSAGEM_TIPOS_ANEXO_PERMITIDOS =
  'Aceita PDF, XLSX, XLS ou CSV.'

function extensaoDoNome(nomeArquivo: string): string {
  const indice = nomeArquivo.lastIndexOf('.')
  if (indice < 0) return ''
  return nomeArquivo.slice(indice).toLowerCase()
}

function mimeValido(valor: string): valor is MimeTipoAnexoFornecedor {
  return (MIME_TIPOS_ANEXO_FORNECEDOR as readonly string[]).includes(valor)
}

export function inferirMimeTypeAnexo(
  nomeArquivo: string,
  mimeTypeInformado?: string | null
): MimeTipoAnexoFornecedor | null {
  const informado = mimeTypeInformado?.trim()
  if (informado && mimeValido(informado)) {
    return informado
  }

  const extensao = extensaoDoNome(nomeArquivo)
  return MIME_POR_EXTENSAO[extensao] ?? null
}

export function validarArquivoAnexoFornecedor(
  nomeArquivo: string,
  mimeTypeInformado?: string | null
): { mimeType: MimeTipoAnexoFornecedor } | { erro: string } {
  const mimeType = inferirMimeTypeAnexo(nomeArquivo, mimeTypeInformado)
  if (!mimeType) {
    return {
      erro: 'Tipo de arquivo não permitido. Envie PDF, XLSX, XLS ou CSV.',
    }
  }
  return { mimeType }
}

export function rotuloTipoAnexo(mimeType: string, nomeArquivo: string): string {
  const resolvido = inferirMimeTypeAnexo(nomeArquivo, mimeType)
  switch (resolvido) {
    case 'application/pdf':
      return 'PDF'
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      return 'Excel'
    case 'text/csv':
      return 'CSV'
    default:
      return extensaoDoNome(nomeArquivo).replace('.', '').toUpperCase() || 'Arquivo'
  }
}

export function formatarTamanhoAnexo(tamanhoBytes: number): string {
  if (!Number.isFinite(tamanhoBytes) || tamanhoBytes <= 0) return '—'
  if (tamanhoBytes < 1024) return `${tamanhoBytes} B`
  if (tamanhoBytes < 1024 * 1024) {
    return `${(tamanhoBytes / 1024).toFixed(tamanhoBytes < 10_240 ? 1 : 0)} KB`
  }
  return `${(tamanhoBytes / (1024 * 1024)).toFixed(1)} MB`
}

export function extensaoEsperadaPorMime(mimeType: MimeTipoAnexoFornecedor): string {
  return EXTENSAO_POR_MIME[mimeType]
}
