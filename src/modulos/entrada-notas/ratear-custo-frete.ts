/**
 * Rateio do custo de frete (CT-e) entre itens da NF de mercadoria.
 * Regras: valor | peso | quantidade | igual.
 *
 * Peso: base = pesoLinhaKg (peso unitário do cadastro × qtd entrada).
 * Sem fallback silencioso — se a base de peso for inválida, retorna erro.
 */
export type RegraRateioFrete = 'valor' | 'peso' | 'quantidade' | 'igual'

export type ItemRateioFrete = {
  id: string
  valorTotal: number | null
  /** Quantidade da NF (regra quantidade) */
  quantidade: number | null
  /**
   * Peso da linha para rateio por peso: peso unitário do produto × qtd entrada.
   * Obrigatório e > 0 quando regra = peso.
   */
  pesoLinhaKg: number | null
}

export type ResultadoRateioItem = {
  id: string
  custoFreteRateado: number
}

export type ResultadoRateioFrete = {
  regraAplicada: RegraRateioFrete
  avisos: string[]
  /** Bloqueios sem rateio (ex.: peso ausente). Quando preenchido, parcelas ficam 0. */
  erros: string[]
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

/**
 * Distribui `valorTotalFrete` entre os itens. Último item absorve residual de arredondamento.
 */
export function ratearCustoFrete(params: {
  regra: string | null | undefined
  itens: ItemRateioFrete[]
  valorTotalFrete: number
}): ResultadoRateioFrete {
  const avisos: string[] = []
  const erros: string[] = []
  const valor = Number(params.valorTotalFrete)
  if (!Number.isFinite(valor) || valor <= 0 || params.itens.length === 0) {
    return {
      regraAplicada: normalizarRegra(params.regra),
      avisos,
      erros,
      itens: params.itens.map((i) => ({ id: i.id, custoFreteRateado: 0 })),
    }
  }

  let regra = normalizarRegra(params.regra)

  if (regra === 'peso') {
    const semPeso = params.itens.filter((i) => {
      const p = i.pesoLinhaKg
      return p == null || !Number.isFinite(p) || p <= 0
    })
    if (semPeso.length > 0) {
      erros.push(
        'Rateio por peso exige peso cadastrado em todos os produtos (peso unitário × quantidade de entrada). Cadastre o peso no produto ou altere a regra de rateio no fornecedor.'
      )
      return {
        regraAplicada: 'peso',
        avisos,
        erros,
        itens: params.itens.map((i) => ({ id: i.id, custoFreteRateado: 0 })),
      }
    }
  }

  const pesos: number[] = params.itens.map((item) => {
    if (regra === 'igual') return 1
    if (regra === 'quantidade') return Math.max(0, item.quantidade ?? 0)
    if (regra === 'peso') return Math.max(0, item.pesoLinhaKg ?? 0)
    return Math.max(0, item.valorTotal ?? 0)
  })

  let soma = pesos.reduce((a, b) => a + b, 0)
  if (soma <= 0) {
    if (regra === 'peso') {
      erros.push(
        'Rateio por peso com peso total zerado. Cadastre o peso no produto ou altere a regra de rateio no fornecedor.'
      )
      return {
        regraAplicada: 'peso',
        avisos,
        erros,
        itens: params.itens.map((i) => ({ id: i.id, custoFreteRateado: 0 })),
      }
    }
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

  return { regraAplicada: regra, avisos, erros, itens: resultados }
}
