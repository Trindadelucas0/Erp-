/**
 * Normaliza o código interno do produto (SKU).
 * Remove pontos (separador visual do Santri) e espaços nas pontas.
 */
export function normalizarSkuProduto(
  sku: string | null | undefined
): string | undefined {
  if (sku == null) return undefined
  const limpo = sku.trim().replace(/\./g, '')
  return limpo || undefined
}
