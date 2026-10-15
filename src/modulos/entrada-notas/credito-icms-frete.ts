import type { RegraCredito } from '../configuracoes/esquema-regras-fiscais.js'

/** Distribui em centavos, preservando o total e a proporção do frete lançado. */
export function ratearCreditoIcmsFrete(
  modFrete: string | null,
  itens: Array<{ id: string; custoFreteRateado: number }>,
  ctes: Array<{ valorFrete: number; valorIcms: number | null }>,
  regra: RegraCredito
): Map<string, number> {
  const resultado = new Map(itens.map((item) => [item.id, 0]))
  if (modFrete !== '1') return resultado
  const elegiveis = itens.filter((item) => Number.isFinite(item.custoFreteRateado) && item.custoFreteRateado > 0)
  const totalFrete = elegiveis.reduce((soma, item) => soma + item.custoFreteRateado, 0)
  if (totalFrete <= 0) return resultado
  const totalCredito = ctes.reduce((soma, cte) => {
    const credito = regra.modo === 'nota' ? cte.valorIcms : cte.valorFrete * (regra.aliquota ?? 0) / 100
    return soma + (credito != null && Number.isFinite(credito) && credito > 0 ? credito : 0)
  }, 0)
  const centavos = Math.round(totalCredito * 100)
  const parcelas = elegiveis.map((item, ordem) => {
    const valor = centavos * item.custoFreteRateado / totalFrete
    return { id: item.id, ordem, centavos: Math.floor(valor), resto: valor - Math.floor(valor) }
  })
  let restantes = centavos - parcelas.reduce((soma, p) => soma + p.centavos, 0)
  const porResto = [...parcelas].sort((a, b) => b.resto - a.resto || a.ordem - b.ordem)
  for (const parcela of porResto) {
    if (restantes <= 0) break
    parcela.centavos++
    restantes--
  }
  for (const parcela of parcelas) resultado.set(parcela.id, parcela.centavos / 100)
  return resultado
}
