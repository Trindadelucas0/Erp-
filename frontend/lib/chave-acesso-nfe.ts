import type { TipoDocumentoEntrada } from '@/lib/tipo-documento-entrada'

/** Série (pos. 22–24) e nNF/nCT (pos. 25–33) da chave de acesso SEFAZ (44 dígitos). */
export function extrairSerieNumeroChave(chave: string): {
  serie: string | null
  numero: string | null
} {
  const digitos = chave.replace(/\D/g, '')
  if (digitos.length !== 44) return { serie: null, numero: null }
  return {
    serie: String(Number(digitos.slice(22, 25))),
    numero: String(Number(digitos.slice(25, 34))),
  }
}

export function prefixoNumeroDocumento(tipo: TipoDocumentoEntrada): string {
  if (tipo === 'nfse') return 'NFS-e'
  if (tipo === 'cte') return 'CT-e'
  return 'NF'
}

export function tituloAnaliseEntrada(
  tipo: TipoDocumentoEntrada,
  numero: string | null
): string {
  if (!numero) return 'Análise de entrada'
  return `Análise de entrada · ${prefixoNumeroDocumento(tipo)} ${numero}`
}
