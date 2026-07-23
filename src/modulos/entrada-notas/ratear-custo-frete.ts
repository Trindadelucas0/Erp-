/**
 * Rateio do custo de frete (CT-e) entre itens da NF de mercadoria.
 * Regras: valor | peso | quantidade | igual.
 */
export type RegraRateioFrete = 'valor' | 'peso' | 'quantidade' | 'igual'

export type ItemRateioFrete = {
  id: string
  valorTotal: number | null
  quantidade: number | null
  pesoKg: number | null
  /** Fallback de peso do cadastro do produto */
  pesoProdutoKg?: number | null
}

export type ResultadoRateioItem = {
  id: string
  custoFreteRateado: number
}

export type ResultadoRateioFrete = {
  regraAplicada: RegraRateioFrete
  avisos: string[]
  itens: ResultadoRateioItem[]
}

function arred2(n: number): number {
  return Math.round(n * 100) / 100
}

function normalizarRegra(regra: string | null | undefined): RegraRateioFrete {
  if (regra === 'peso' || regra === 'quantidade' || regra === 'igual' || regra === 'valor') {
    return regra
  }
  return 'valor'
}

function pesoDoItem(item: ItemRateioFrete): number {
  const xml = item.pesoKg ?? 0
  if (xml > 0) return xml
  return item.pesoProdutoKg ?? 0
}

/**
 * Distribui `valorTotalFrete` entre os itens. Último item absorve residual de arredondamento.
 */
export function ratearCustoFrete(params: {
  regra: string | null | undefined
  itens: ItemRateioFrete[]
  valorTotalFrete: number
}): ResultadoRateioFrete {
  const avisos: string[] = []
  const valor = Number(params.valorTotalFrete)
  if (!Number.isFinite(valor) || valor <= 0 || params.itens.length === 0) {
    return {
      regraAplicada: normalizarRegra(params.regra),
      avisos,
      itens: params.itens.map((i) => ({ id: i.id, custoFreteRateado: 0 })),
    }
  }

  let regra = normalizarRegra(params.regra)

  if (regra === 'peso') {
    const somaPeso = params.itens.reduce((acc, i) => acc + pesoDoItem(i), 0)
    if (somaPeso <= 0) {
      avisos.push('Rateio por peso sem pesos válidos — usando valor dos itens.')
      regra = 'valor'
    }
  }

  const pesos: number[] = params.itens.map((item) => {
    if (regra === 'igual') return 1
    if (regra === 'quantidade') return Math.max(0, item.quantidade ?? 0)
    if (regra === 'peso') return Math.max(0, pesoDoItem(item))
    return Math.max(0, item.valorTotal ?? 0)
  })

  let soma = pesos.reduce((a, b) => a + b, 0)
  if (soma <= 0) {
    avisos.push('Base de rateio zerada — dividindo igualmente.')
    regra = 'igual'
    for (let i = 0; i < pesos.length; i++) pesos[i] = 1
    soma = pesos.length
  }

  const resultados: ResultadoRateioItem[] = []
  let acumulado = 0
  for (let i = 0; i < params.itens.length; i++) {
    const ehUltimo = i === params.itens.length - 1
    const parcela = ehUltimo ? arred2(valor - acumulado) : arred2((valor * pesos[i]) / soma)
    acumulado = arred2(acumulado + parcela)
    resultados.push({ id: params.itens[i].id, custoFreteRateado: parcela })
  }

  return { regraAplicada: regra, avisos, itens: resultados }
}
