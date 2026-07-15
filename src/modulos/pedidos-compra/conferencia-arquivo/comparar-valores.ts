/**
 * Helpers de normalização e comparação usados pelo matcher e pelo comparador
 * de cabeçalho. Mesmo espírito de normalização textual já usado em
 * conferencia-po-entrada.ts, reaproveitado aqui para o fluxo de IA.
 */
export function normalizarTexto(valor?: string | null): string {
  return (valor ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function normalizarPalavras(valor?: string | null): Set<string> {
  return new Set(
    normalizarTexto(valor)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  )
}

export function similaridadeNomes(a?: string | null, b?: string | null): number {
  const ta = normalizarPalavras(a)
  const tb = normalizarPalavras(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let interseccao = 0
  for (const palavra of ta) {
    if (tb.has(palavra)) interseccao++
  }
  return interseccao / Math.max(ta.size, tb.size)
}

export function diferencaPercentual(a: number, b: number): number {
  if (a === 0 && b === 0) return 0
  const base = Math.max(Math.abs(a), Math.abs(b), 0.0001)
  return Math.abs(a - b) / base
}
