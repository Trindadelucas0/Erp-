/**
 * Converte o texto digitado em Qtd. Entrada para número persistível.
 * Campo vazio ou inválido → 0 (contrato da API: min 0).
 */
export function textoQtdParaNumero(texto: string): number {
  const limpo = texto.trim()
  if (limpo === '') return 0
  const n = Number(limpo)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}
