export type BaseRateioCte = {
  id: string
  valorBase: number
}

/**
 * Distribui um total em centavos proporcionalmente às bases informadas.
 * O resto vai para as maiores frações; empate é resolvido pelo id para manter
 * o resultado determinístico em novas análises da mesma entrada.
 */
export function ratearProporcionalCentavos(
  valorTotal: number,
  bases: BaseRateioCte[]
): Map<string, number> {
  if (!Number.isFinite(valorTotal) || valorTotal < 0) {
    throw new Error('Valor total inválido para rateio do CT-e.')
  }
  if (bases.length === 0) return new Map()
  if (bases.some((base) => !Number.isFinite(base.valorBase) || base.valorBase <= 0)) {
    throw new Error('Todas as NF-e vinculadas precisam ter valor total positivo para ratear o CT-e.')
  }

  const totalCentavos = Math.round(valorTotal * 100)
  const somaBases = bases.reduce((soma, base) => soma + base.valorBase, 0)
  const parcelas = bases.map((base) => {
    const exato = (totalCentavos * base.valorBase) / somaBases
    const centavos = Math.floor(exato)
    return { ...base, centavos, resto: exato - centavos }
  })
  let restantes = totalCentavos - parcelas.reduce((soma, parcela) => soma + parcela.centavos, 0)
  const ordemResto = [...parcelas].sort(
    (a, b) => b.resto - a.resto || a.id.localeCompare(b.id)
  )
  for (const parcela of ordemResto) {
    if (restantes <= 0) break
    parcela.centavos += 1
    restantes -= 1
  }

  return new Map(parcelas.map((parcela) => [parcela.id, parcela.centavos / 100]))
}
