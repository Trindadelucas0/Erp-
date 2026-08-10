/**
 * Rateio do custo de frete (CT-e) entre itens da NF de mercadoria.
 * Regras: valor | peso | quantidade | igual.
 *
 * Peso: base = pesoLinhaKg (peso unitário do cadastro × qtd entrada).
 * Sem fallback silencioso — se a base de peso for inválida, retorna erro.
 * Nenhum item com base > 0 deve ficar com parcela R$ 0,00 quando há frete a ratear.
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
  /** Bloqueios sem rateio (ex.: peso ausente). Quando preenchido, não persistir parcelas. */
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
 * Rateio por resto maior: evita parcela R$ 0,00 em item com base > 0.
 * Últimos centavos vão para quem tem maior parte fracionária (prioriza base > 0).
 */
function distribuirPorRestoMaior(valor: number, pesos: number[], ids: string[]): ResultadoRateioItem[] {
  const totalCentavos = Math.round(valor * 100)
  const somaPesos = pesos.reduce((a, b) => a + b, 0)
  if (somaPesos <= 0 || totalCentavos <= 0) {
    return ids.map((id) => ({ id, custoFreteRateado: 0 }))
  }

  const exatos = pesos.map((p) => (totalCentavos * p) / somaPesos)
  const floors = exatos.map((e) => Math.floor(e))
  let restante = totalCentavos - floors.reduce((a, b) => a + b, 0)

  const ordem = exatos
    .map((e, i) => ({ i, frac: e - floors[i], peso: pesos[i] }))
    .sort((a, b) => {
      if (b.frac !== a.frac) return b.frac - a.frac
      return b.peso - a.peso
    })

  const centavos = [...floors]
  for (const { i } of ordem) {
    if (restante <= 0) break
    if (pesos[i] <= 0) continue
    centavos[i] += 1
    restante -= 1
  }
  // Se ainda sobrar (só bases zeradas na ordem), joga no maior peso
  if (restante > 0) {
    let idxMaior = 0
    for (let i = 1; i < pesos.length; i++) {
      if (pesos[i] > pesos[idxMaior]) idxMaior = i
    }
    centavos[idxMaior] += restante
  }

  // Item com base > 0 e 0 centavos: tira 1 centavo do maior e dá a ele
  for (let i = 0; i < pesos.length; i++) {
    if (pesos[i] <= 0 || centavos[i] > 0) continue
    let doador = -1
    for (let j = 0; j < pesos.length; j++) {
      if (j === i) continue
      if (centavos[j] > 1 && (doador < 0 || centavos[j] > centavos[doador])) doador = j
    }
    if (doador >= 0) {
      centavos[doador] -= 1
      centavos[i] += 1
    }
  }

  return ids.map((id, i) => ({
    id,
    custoFreteRateado: arred2(centavos[i] / 100),
  }))
}

/**
 * Distribui `valorTotalFrete` entre os itens.
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
    if (params.itens.length > 0 && !(Number.isFinite(valor) && valor > 0)) {
      erros.push('Valor do frete ausente ou zerado — não é possível ratear nos itens.')
    }
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

  const resultados = distribuirPorRestoMaior(
    valor,
    pesos,
    params.itens.map((i) => i.id)
  )

  if (regra === 'peso') {
    const zeradoComPeso = resultados.some((r, i) => (pesos[i] ?? 0) > 0 && r.custoFreteRateado <= 0)
    if (zeradoComPeso) {
      erros.push(
        'Rateio por peso gerou frete R$ 0,00 em item com peso. Verifique os pesos cadastrados ou o valor do frete.'
      )
      return {
        regraAplicada: 'peso',
        avisos,
        erros,
        itens: params.itens.map((i) => ({ id: i.id, custoFreteRateado: 0 })),
      }
    }
  }

  return { regraAplicada: regra, avisos, erros, itens: resultados }
}
