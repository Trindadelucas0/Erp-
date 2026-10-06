export type TaxaParaTravaTipo = {
  numeroParcelas: number
  taxaPercentual: string
  prazoDias: number | ''
  valorFixo: string
}

export type EntradaTravaTipoCartao = {
  cartaoJaSalvo: boolean
  bandeira: string
  nomeExibicao: string
  adquirenteId: string
  taxas: TaxaParaTravaTipo[]
}

function taxaForaDoDefault(t: TaxaParaTravaTipo): boolean {
  if (t.numeroParcelas !== 1) return true
  if (t.taxaPercentual.trim() !== '0,00') return true
  if (t.prazoDias !== 30 && t.prazoDias !== '') return true
  if (t.valorFixo.trim() !== '0,00') return true
  return false
}

export function tipoCartaoTravado(entrada: EntradaTravaTipoCartao): boolean {
  if (entrada.cartaoJaSalvo) return true
  if (entrada.bandeira.trim()) return true
  if (entrada.nomeExibicao.trim()) return true
  if (entrada.adquirenteId.trim()) return true
  if (entrada.taxas.length > 1) return true
  if (entrada.taxas.some(taxaForaDoDefault)) return true
  return false
}
