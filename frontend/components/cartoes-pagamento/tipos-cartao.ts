import type { CodigoBandeiraCartao, TipoCartaoPagamento } from '@/lib/bandeiras-cartao'

export type AdquirenteLista = {
  id: string
  nome: string
  ativo: boolean
}

export type TaxaCartaoForm = {
  numeroParcelas: number
  taxaPercentual: string
  prazoDias: number
  valorFixo: string
}

export type CartaoPagamentoLista = {
  id: string
  bandeira: CodigoBandeiraCartao | string
  tipo: TipoCartaoPagamento | string
  nomeExibicao: string
  ativo: boolean
  permitirParcelamento: boolean
  adquirenteId: string
  adquirente: { id: string; nome: string; ativo: boolean } | null
  taxas: Array<{
    id?: string
    numeroParcelas: number
    taxaPercentual: number
    prazoDias: number
    valorFixo: number
  }>
}

export function formatarPercentualBr(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

export function formatarMoedaInput(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function parseNumeroBr(texto: string): number {
  const limpo = texto.trim().replace(/\s/g, '')
  if (!limpo) return NaN
  if (limpo.includes(',')) {
    return Number(limpo.replace(/\./g, '').replace(',', '.'))
  }
  return Number(limpo)
}
