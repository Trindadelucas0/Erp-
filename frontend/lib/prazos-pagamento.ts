/** Cálculo de vencimento a partir da data de faturamento e dias de prazo. */

export function calcularVencimentoPorDias(dataFaturamento: string, dias: string): string {
  const n = parseInt(dias.replace(/\D/g, ''), 10)
  if (!dataFaturamento?.trim() || !Number.isFinite(n) || n < 0) return ''
  const base = new Date(`${dataFaturamento}T12:00:00`)
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + n)
  return base.toISOString().slice(0, 10)
}

export function calcularDiasEntreDatas(dataFaturamento: string, vencimento: string): string {
  if (!dataFaturamento?.trim() || !vencimento?.trim()) return ''
  const inicio = new Date(`${dataFaturamento}T12:00:00`)
  const fim = new Date(`${vencimento}T12:00:00`)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return ''
  const diff = Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
  return diff >= 0 ? String(diff) : ''
}

export function formatarDataBr(iso: string): string {
  if (!iso?.trim()) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}
