/**
 * Define transição de status ao editar pedido de compra com flag concluir.
 */
export function statusAposEdicao(statusAtual: string, concluir?: boolean): string | undefined {
  if (concluir && statusAtual === 'rascunho') return 'enviado'
  return undefined
}
