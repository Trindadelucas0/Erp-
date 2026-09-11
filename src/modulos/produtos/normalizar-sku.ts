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

/**
 * Tokens para buscar SKU/nome ignorando ponto visual (`9.325` e `9325`).
 * Só-pontos não entram na busca.
 */
export function tokensSkuParaBusca(token: string): string[] {
  const original = token.trim()
  if (!original) return []
  const semPonto = original.replace(/\./g, '')
  if (!semPonto) return []
  if (semPonto === original) return [original]
  return [original, semPonto]
}

/** Token numérico ou com ponto: o cadastro pode ter o outro formato. */
export function tokenExigeBuscaSemPonto(token: string): boolean {
  return token.includes('.') || /\d/.test(token)
}
