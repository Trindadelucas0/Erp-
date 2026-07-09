/** Rateio de parcelas do pedido de compra (espelho do backend). */

export const TOLERANCIA_PARCELAS = 0.01

export type PrazoComValor = {
  numero: number
  vencimento: string
  valor?: number | string | null
  dias?: string
}

export function distribuirParcelasIguais(totalParcelas: number, total: number): number[] {
  if (totalParcelas <= 0) return []
  if (total <= 0) return Array(totalParcelas).fill(0)
  const base = Math.floor((total / totalParcelas) * 100) / 100
  const valores = Array(totalParcelas).fill(base)
  const soma = valores.reduce((s, v) => s + v, 0)
  valores[valores.length - 1] = Math.round((valores[valores.length - 1] + (total - soma)) * 100) / 100
  return valores
}

function baseParaRateio(prazos: PrazoComValor[]): PrazoComValor[] {
  const comVencimento = prazos.filter((p) => p.vencimento?.trim())
  return comVencimento.length > 0 ? comVencimento : prazos
}

function aplicarValoresNosPrazos(
  prazos: PrazoComValor[],
  base: PrazoComValor[],
  valores: number[]
): PrazoComValor[] {
  const mapaValores = new Map<number, number>()
  base.forEach((p, i) => mapaValores.set(p.numero, valores[i] ?? 0))
  return prazos.map((p) => {
    const valor = mapaValores.get(p.numero)
    if (valor === undefined) return p
    return { ...p, valor: String(valor) }
  })
}

export function redistribuirParcelasManuaisProporcionalmente(
  prazos: PrazoComValor[],
  totalNovo: number
): PrazoComValor[] {
  const base = baseParaRateio(prazos)
  if (base.length === 0) return prazos

  const pesos = base.map((p) => parseValorParcela(p.valor) ?? 0)
  const somaPesos = pesos.reduce((soma, peso) => soma + peso, 0)

  if (somaPesos <= 0 || totalNovo <= 0) {
    const valores = distribuirParcelasIguais(base.length, totalNovo)
    return aplicarValoresNosPrazos(prazos, base, valores)
  }

  const valores: number[] = []
  let somaDistribuida = 0
  for (let i = 0; i < base.length; i++) {
    if (i === base.length - 1) {
      valores.push(Math.round((totalNovo - somaDistribuida) * 100) / 100)
    } else {
      const valor = Math.floor(((totalNovo * pesos[i]) / somaPesos) * 100) / 100
      valores.push(valor)
      somaDistribuida += valor
    }
  }

  return aplicarValoresNosPrazos(prazos, base, valores)
}

export function sincronizarValoresParcelasComTotal(
  prazos: PrazoComValor[],
  rateioParcelas: string,
  totalLiquido: number
): PrazoComValor[] {
  if (prazos.length === 0) return prazos

  if (rateioParcelas === 'igual') {
    const base = baseParaRateio(prazos)
    const valores = distribuirParcelasIguais(base.length, totalLiquido)
    return aplicarValoresNosPrazos(prazos, base, valores)
  }

  return redistribuirParcelasManuaisProporcionalmente(prazos, totalLiquido)
}

export function prazosValoresIguais(
  a: PrazoComValor[],
  b: PrazoComValor[]
): boolean {
  if (a.length !== b.length) return false
  return a.every((prazo, indice) => {
    const valorA = parseValorParcela(prazo.valor)
    const valorB = parseValorParcela(b[indice]?.valor)
    if (valorA == null && valorB == null) return true
    if (valorA == null || valorB == null) return false
    return Math.abs(valorA - valorB) < TOLERANCIA_PARCELAS
  })
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
