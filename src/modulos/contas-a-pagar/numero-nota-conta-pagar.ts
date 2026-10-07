/**
 * Número da NF-e para exibição no selo de origem (Contas a pagar).
 * nNF nas posições 25–33 da chave SEFAZ (44 dígitos); fallback no documento do título.
 */
export function numeroNotaContaPagar(
  origem: string,
  chaveNfe: string | null | undefined,
  numeroDocumentoTitulo: string | null | undefined
): string | null {
  if (origem !== 'nfe') return null

  const chave = chaveNfe?.trim() ?? ''
  const digitos = chave.replace(/\D/g, '')
  if (digitos.length === 44) {
    const n = Number(digitos.slice(25, 34))
    if (Number.isFinite(n) && n > 0) return String(n)
  }

  const doc = numeroDocumentoTitulo?.trim()
  return doc || null
}
