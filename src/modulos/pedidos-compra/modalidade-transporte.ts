/**
 * Modalidades de transporte do pedido de compra e normalização legada.
 */
export const MODALIDADES_TRANSPORTE_PEDIDO = ['FOB_NOTA', 'FOB_CONHECIMENTO', 'CIF'] as const

export type ModalidadeTransportePedido = (typeof MODALIDADES_TRANSPORTE_PEDIDO)[number]

export function normalizarModalidadeTransporte(valor?: string | null): string {
  const texto = (valor ?? '').trim()
  if (!texto) return ''
  if (texto.toUpperCase() === 'RETIRA') return 'CIF'
  return texto
}

export function exigeDadosTransporte(modalidade?: string | null): boolean {
  const normalizada = normalizarModalidadeTransporte(modalidade)
  return normalizada === 'FOB_NOTA' || normalizada === 'FOB_CONHECIMENTO'
}
