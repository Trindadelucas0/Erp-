export const RECEBER_PAGAMENTO_EM_DESENVOLVIMENTO = false

export const CHAVE_AVISO = 'receber-pagamento-aviso'

export const TITULO_CARD_DESENVOLVIMENTO = 'Em desenvolvimento'

export const TEXTO_CARD_DESENVOLVIMENTO = [
  'Esta tela ainda está em desenvolvimento.',
  'Confirmar pagamento não grava daqui.',
] as const

export const FORMAS_PAGAMENTO_UI = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'cartao_credito', rotulo: 'Cartão de crédito' },
  { valor: 'cartao_debito', rotulo: 'Cartão de débito' },
  { valor: 'boleto', rotulo: 'Boleto' },
] as const

export const FORMAS_TOTEM_UI = FORMAS_PAGAMENTO_UI.filter((f) => f.valor !== 'dinheiro')

export type FormaPagamentoUi = (typeof FORMAS_PAGAMENTO_UI)[number]['valor']

export function rotuloFormaPagamento(forma: string | null | undefined) {
  if (!forma) return '—'
  return FORMAS_PAGAMENTO_UI.find((item) => item.valor === forma)?.rotulo ?? forma
}

export function fraseSeparacoes(numeros: number[]) {
  if (numeros.length === 0) return 'Pagamento confirmado.'
  if (numeros.length === 1) {
    return `Pagamento confirmado. Separação ${numeros[0]} está em Separação de pedidos.`
  }
  const ultimo = numeros[numeros.length - 1]
  const inicio = numeros.slice(0, -1).join(', ')
  return `Pagamento confirmado. Separações ${inicio} e ${ultimo} estão em Separação de pedidos.`
}
