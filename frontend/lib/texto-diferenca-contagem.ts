export function formatarQtdContagem(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
}

export function textoDiferencaContagem(diferenca: number): string {
  if (Math.abs(diferenca) < 1e-9) return 'Bateu'
  if (diferenca < 0) return `Faltou ${formatarQtdContagem(Math.abs(diferenca))}`
  return `Sobrou ${formatarQtdContagem(diferenca)}`
}
