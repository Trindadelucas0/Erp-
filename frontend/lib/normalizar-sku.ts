/** Mesma regra do backend: SKU sem ponto (separador visual do Santri). */
export function normalizarSkuProduto(
  sku: string | null | undefined
): string | undefined {
  if (sku == null) return undefined
  const limpo = sku.trim().replace(/\./g, '')
  return limpo || undefined
}

/** Tokens para buscar SKU/nome ignorando ponto visual (`9.325` e `9325`). */
export function tokensSkuParaBusca(token: string): string[] {
  const original = token.trim()
  if (!original) return []
  const semPonto = original.replace(/\./g, '')
  if (!semPonto) return []
  if (semPonto === original) return [original]
  return [original, semPonto]
}
