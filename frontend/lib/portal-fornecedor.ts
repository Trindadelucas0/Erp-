/**
 * Utilitários compartilhados entre as páginas públicas do portal do fornecedor.
 */
export const CHAVE_TOKEN_PORTAL_FORNECEDOR = 'portalFornecedorToken'

export function obterTokenPortalFornecedor(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CHAVE_TOKEN_PORTAL_FORNECEDOR)
}

export function limparTokenPortalFornecedor(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CHAVE_TOKEN_PORTAL_FORNECEDOR)
}
