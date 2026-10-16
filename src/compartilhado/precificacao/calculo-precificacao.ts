export type BasePrecificacao = {
  precoTabela: number | null
  desconto: number
  ipi: number
  outras: number
  frete: number
  tipoFrete: string
  transporteSimples: boolean | null
  st: number
  creditoIcms: number
  creditoIcmsFrete: number
  creditoPisCofins: number
}

export type AjustesPrecificacao = {
  precoTabela?: number
  descontoPercentual?: number
  descontoDestaquePercentual?: number
  ipiPercentual?: number
  outrasPercentual?: number
  fretePercentual?: number
  freteValor?: number
  tipoFrete?: string
  transporteSimples?: boolean | null
  tipoSt?: 'sem' | 'nota' | 'adicional'
  stPercentual?: number
  creditoIcmsPercentual?: number
  creditoIcmsFretePercentual?: number
  pisCofinsPercentual?: number
  adicionalPercentual?: number
  adicionalValor?: number
}

export const percentualDe = (valor: number, base: number) => base > 0 ? valor / base * 100 : 0
const arred4 = (valor: number) => Math.round(valor * 10000) / 10000

/** Parâmetros ausentes preservam os valores monetários originais, sem ida e volta por percentuais. */
export function calcularAquisicao(base: BasePrecificacao, ajustes: AjustesPrecificacao = {}) {
  let erro: string | null = null
  for (const [campo, valor] of Object.entries(ajustes)) {
    if (typeof valor === 'number' && (!Number.isFinite(valor) || valor < 0 || valor > 1e12)) erro = `Valor inválido: ${campo}.`
    if (campo.endsWith('Percentual') && typeof valor === 'number' && valor > 100) erro = 'Percentuais devem estar entre 0 e 100%.'
  }
  if (ajustes.freteValor != null && ajustes.fretePercentual != null) erro = 'Informe frete em percentual ou reais.'
  if (ajustes.adicionalValor != null && ajustes.adicionalPercentual != null) erro = 'Informe custo adicional em percentual ou reais.'
  for (const campo of ['descontoPercentual', 'descontoDestaquePercentual', 'creditoIcmsPercentual', 'creditoIcmsFretePercentual', 'pisCofinsPercentual'] as const) {
    if ((ajustes[campo] ?? 0) > 100) erro = 'Descontos e créditos não podem exceder 100%.'
  }
  const tabela = ajustes.precoTabela ?? base.precoTabela ?? 0
  const desconto = ajustes.descontoPercentual == null ? base.desconto : tabela * ajustes.descontoPercentual / 100
  const mercadoria = (tabela - desconto) * (1 - (ajustes.descontoDestaquePercentual ?? 0) / 100)
  const componente = (percentual: number | undefined, original: number, denominador = mercadoria) => percentual == null ? original : denominador * percentual / 100
  const tipoFrete = ajustes.tipoFrete ?? base.tipoFrete
  const frete = tipoFrete === '0' || tipoFrete === '9' ? 0 : ajustes.freteValor ?? componente(ajustes.fretePercentual, base.frete)
  const simples = ajustes.transporteSimples === undefined ? base.transporteSimples : ajustes.transporteSimples
  const creditoFretePretendido = componente(ajustes.creditoIcmsFretePercentual, base.creditoIcmsFrete, frete)
  if (frete > 0 && creditoFretePretendido > 0 && simples == null) erro = 'Informe se o transportador está no Simples antes de utilizar crédito de ICMS frete.'
  const creditoFrete = frete > 0 && simples !== true ? creditoFretePretendido : 0
  const tipoSt = ajustes.tipoSt ?? (base.st > 0 ? 'nota' : 'sem')
  const st = tipoSt === 'nota' ? base.st : tipoSt === 'adicional' ? mercadoria * (ajustes.stPercentual ?? 0) / 100 : 0
  const subtotal = mercadoria + componente(ajustes.ipiPercentual, base.ipi) + componente(ajustes.outrasPercentual, base.outras) + frete + st
    - componente(ajustes.creditoIcmsPercentual, base.creditoIcms) - creditoFrete - componente(ajustes.pisCofinsPercentual, base.creditoPisCofins)
  const adicional = ajustes.adicionalValor ?? subtotal * (ajustes.adicionalPercentual ?? 0) / 100
  const custo = subtotal + adicional
  if (base.precoTabela == null || mercadoria <= 0 || !Number.isFinite(custo) || custo <= 0) erro ??= 'Custo de aquisição inválido.'
  return { custo: erro ? null : arred4(custo), erro, mercadoria, subtotal, frete, adicional, st, creditoFrete }
}

export function precoPorMargem(custo: number | null, encargos: number, margem: number) {
  if (custo == null || !Number.isFinite(custo) || custo <= 0 || !Number.isFinite(encargos) || encargos < 0 || !Number.isFinite(margem) || encargos + margem >= 100) return null
  return arred4(custo / (1 - (encargos + margem) / 100))
}

export function margemPorPreco(custo: number | null, encargos: number, preco: number | null) {
  if (custo == null || custo <= 0 || preco == null || !Number.isFinite(preco) || preco <= 0) return null
  return arred4((1 - encargos / 100 - custo / preco) * 100)
}
