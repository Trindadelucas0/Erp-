const ENTIDADES_NOMEADAS: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function codePointParaChar(code: number, original: string): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return original
  try {
    return String.fromCodePoint(code)
  } catch {
    return original
  }
}

/**
 * Decodifica entidades XML/HTML comuns (`&amp;` → `&`).
 * Usado em texto extraído de XML fiscal e em nomes vindos de APIs.
 */
export function decodificarEntidadesXml(texto: string): string {
  if (!texto.includes('&')) return texto
  return texto.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (original, ent: string) => {
    if (ent[0] === '#') {
      const hex = ent[1] === 'x' || ent[1] === 'X'
      const code = Number.parseInt(hex ? ent.slice(2) : ent.slice(1), hex ? 16 : 10)
      return codePointParaChar(code, original)
    }
    return ENTIDADES_NOMEADAS[ent.toLowerCase()] ?? original
  })
}

export function decodificarTextoXml(valor: string | null | undefined): string | null {
  if (valor == null) return null
  return decodificarEntidadesXml(valor)
}
