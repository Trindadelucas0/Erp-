/**
 * Trava anti-execução duplicada da conferência por IA — em memória, por pedidoId.
 * Evita disparar a IA duas vezes em paralelo para o mesmo pedido (custo + resultado
 * inconsistente). Sem persistência no MVP (sem histórico de conferência).
 */
const pedidosEmAndamento = new Set<string>()

export function tentarTravarConferencia(pedidoCompraId: string): boolean {
  if (pedidosEmAndamento.has(pedidoCompraId)) return false
  pedidosEmAndamento.add(pedidoCompraId)
  return true
}

export function liberarTravaConferencia(pedidoCompraId: string): void {
  pedidosEmAndamento.delete(pedidoCompraId)
}
