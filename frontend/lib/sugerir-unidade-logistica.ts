/**
 * Sugere unidade logística a partir da unidade de entrada do fornecedor,
 * apenas quando a logística ainda está vazia e a entrada difere da venda.
 */
export function sugerirUnidadeLogisticaDeEntrada(params: {
  unidadeVenda: string
  unidadeLogisticaAtual: string
  unidadeEntrada: string
}): string {
  if (params.unidadeLogisticaAtual.trim()) return params.unidadeLogisticaAtual
  const venda = params.unidadeVenda.trim().toUpperCase()
  const entrada = params.unidadeEntrada.trim().toUpperCase()
  if (!entrada || !venda || entrada === venda) return params.unidadeLogisticaAtual
  return entrada
}
