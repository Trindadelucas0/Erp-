import type { FormaPagamentoUi } from '@/lib/receber-pagamento-desenvolvimento'

export const FORMAS_TOTEM_TOUCH = ['pix', 'cartao_debito', 'cartao_credito'] as const

export type FormaTotemTouch = (typeof FORMAS_TOTEM_TOUCH)[number]

export type OpcoesTotemRecebimento = {
  chavePix: string | null
  parcelasCredito: Array<{ numeroParcelas: number }>
}

export function normalizarFormaTotemTouch(forma: FormaPagamentoUi): FormaTotemTouch {
  if (forma === 'cartao_debito' || forma === 'cartao_credito') return forma
  return 'pix'
}

export function rotuloFormaTotemTouch(forma: FormaTotemTouch) {
  switch (forma) {
    case 'pix':
      return 'Pix'
    case 'cartao_debito':
      return 'Cartão de débito'
    case 'cartao_credito':
      return 'Cartão de crédito'
  }
}
