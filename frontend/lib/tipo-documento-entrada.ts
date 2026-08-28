/** Rótulos e helpers para tipos da Entrada de Notas (NFe / NFS-e / CTe). */

export type TipoDocumentoEntrada = 'nfe55' | 'nfse' | 'cte' | string | null | undefined

export function ehDocumentalEntrada(tipo: TipoDocumentoEntrada): boolean {
  return tipo === 'nfse' || tipo === 'cte'
}

/** NFS-e ou NFe custo/consumo — sem contagem física nem movimento de estoque. */
export function ehSemContagemFisicaEntrada(
  tipo: TipoDocumentoEntrada,
  modoDocumental?: boolean | null
): boolean {
  return tipo === 'nfse' || Boolean(modoDocumental)
}

export function rotuloTipoDocumentoCurto(tipo: TipoDocumentoEntrada): string {
  if (tipo === 'nfse') return 'NFS-e'
  if (tipo === 'cte') return 'CTe'
  return 'NFe'
}

export function rotuloTipoDocumentoLongo(tipo: TipoDocumentoEntrada): string {
  if (tipo === 'nfse') return 'NFS-e (serviço)'
  if (tipo === 'cte') return 'CTe (transporte)'
  return 'NFe 55 (produto)'
}

export function prefixoPdfDocumento(tipo: TipoDocumentoEntrada): string {
  if (tipo === 'nfse') return 'DANFSe'
  if (tipo === 'cte') return 'DACTe'
  return 'DANFE'
}

export function varianteBadgeTipo(tipo: TipoDocumentoEntrada): 'info' | 'pendente' | 'sucesso' {
  if (tipo === 'nfse') return 'info'
  if (tipo === 'cte') return 'pendente'
  return 'sucesso'
}
