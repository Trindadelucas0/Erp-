export const CODIGOS_BANDEIRA_CARTAO = [
  'visa',
  'mastercard',
  'elo',
  'amex',
  'hipercard',
] as const

export type CodigoBandeiraCartao = (typeof CODIGOS_BANDEIRA_CARTAO)[number]

export const TIPOS_CARTAO_PAGAMENTO = ['credito', 'debito'] as const

export type TipoCartaoPagamento = (typeof TIPOS_CARTAO_PAGAMENTO)[number]

export const BANDEIRAS_CARTAO: ReadonlyArray<{
  codigo: CodigoBandeiraCartao
  rotulo: string
  rotuloSugestao: string
}> = [
  { codigo: 'visa', rotulo: 'Visa', rotuloSugestao: 'Visa' },
  { codigo: 'mastercard', rotulo: 'Mastercard', rotuloSugestao: 'Mastercard' },
  { codigo: 'elo', rotulo: 'Elo', rotuloSugestao: 'Elo' },
  {
    codigo: 'amex',
    rotulo: 'American Express (Amex)',
    rotuloSugestao: 'American Express',
  },
  { codigo: 'hipercard', rotulo: 'Hipercard', rotuloSugestao: 'Hipercard' },
]

export const PRAZOS_DIAS_TAXA_CARTAO = [1, 2, 7, 14, 21, 30, 45, 60] as const

export function rotuloBandeira(codigo: string): string {
  return BANDEIRAS_CARTAO.find((b) => b.codigo === codigo)?.rotulo ?? codigo
}

export function sugerirNomeExibicao(
  bandeira: CodigoBandeiraCartao,
  tipo: TipoCartaoPagamento
): string {
  const item = BANDEIRAS_CARTAO.find((b) => b.codigo === bandeira)
  const base = item?.rotuloSugestao ?? bandeira
  return `${base} ${tipo === 'credito' ? 'Crédito' : 'Débito'}`
}

export function ehNomePadraoBandeira(nome: string): boolean {
  const n = nome.trim()
  return BANDEIRAS_CARTAO.some((b) => {
    const credito = `${b.rotuloSugestao} Crédito`
    const debito = `${b.rotuloSugestao} Débito`
    return n === credito || n === debito
  })
}
