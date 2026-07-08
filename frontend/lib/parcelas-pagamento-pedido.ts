/** Rateio de parcelas do pedido de compra (espelho do backend). */

export const TOLERANCIA_PARCELAS = 0.01

export function distribuirParcelasIguais(totalParcelas: number, total: number): number[] {
  if (totalParcelas <= 0) return []
  if (total <= 0) return Array(totalParcelas).fill(0)
  const base = Math.floor((total / totalParcelas) * 100) / 100
  const valores = Array(totalParcelas).fill(base)
  const soma = valores.reduce((s, v) => s + v, 0)
  valores[valores.length - 1] = Math.round((valores[valores.length - 1] + (total - soma)) * 100) / 100
  return valores
}

export function parseValorParcela(valor: unknown): number | null {
  if (valor == null || valor === '') return null
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export function somarParcelasManual(
  prazos: { vencimento: string; valor?: number | string | null }[]
): number {
  return prazos
    .filter((p) => p.vencimento?.trim())
    .reduce((s, p) => s + (parseValorParcela(p.valor) ?? 0), 0)
}

export function validarSomaParcelasManual(
  prazos: { vencimento: string; valor?: number | string | null }[],
  totalLiquido: number
): string | null {
  const comVencimento = prazos.filter((p) => p.vencimento?.trim())
  if (!comVencimento.length) return null

  for (const p of comVencimento) {
    const valor = parseValorParcela(p.valor)
    if (valor == null || valor <= 0) {
      return 'Informe o valor (R$) de cada parcela com vencimento no rateio manual.'
    }
  }

  const soma = somarParcelasManual(prazos)
  if (Math.abs(soma - totalLiquido) > TOLERANCIA_PARCELAS) {
    return `Soma das parcelas (${soma.toFixed(2)}) difere do total líquido (${totalLiquido.toFixed(2)}).`
  }

  return null
}

export function montarPrazosParaPayload(
  prazos: { numero: number; vencimento: string; valor?: number | string | null }[],
  rateioParcelas: string,
  totalLiquido: number
) {
  const comVencimento = prazos.filter((p) => p.vencimento?.trim())
  if (!comVencimento.length) return null

  if (rateioParcelas === 'igual') {
    const valores = distribuirParcelasIguais(comVencimento.length, totalLiquido)
    return comVencimento.map((p, i) => ({
      numero: p.numero,
      vencimento: p.vencimento,
      valor: valores[i] ?? 0,
    }))
  }

  return comVencimento.map((p) => ({
    numero: p.numero,
    vencimento: p.vencimento,
    valor: parseValorParcela(p.valor) ?? 0,
  }))
}
