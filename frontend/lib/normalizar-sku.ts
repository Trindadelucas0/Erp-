/** Mesma regra do backend: SKU sem ponto (separador visual do Santri). */
export function normalizarSkuProduto(
  sku: string | null | undefined
): string | undefined {
  if (sku == null) return undefined
  const limpo = sku.trim().replace(/\./g, '')
  return limpo || undefined
}
