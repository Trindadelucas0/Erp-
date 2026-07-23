/**
 * Deep-link Entrada de Notas → modal Novo fornecedor.
 * Intent em sessionStorage (origem grava antes do push; destino só lê).
 */

export const FORNECEDOR_DEEP_LINK_KEY = 'fornecedores:deepLinkNovo'

export type DeepLinkNovoFornecedor = {
  documento: string
  nome?: string
  retorno?: string | null
}

export function lerDeepLinkFornecedor(): DeepLinkNovoFornecedor | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(FORNECEDOR_DEEP_LINK_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DeepLinkNovoFornecedor
  } catch {
    return null
  }
}

export function gravarDeepLinkFornecedor(dados: DeepLinkNovoFornecedor) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(FORNECEDOR_DEEP_LINK_KEY, JSON.stringify(dados))
}

export function limparDeepLinkFornecedor() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(FORNECEDOR_DEEP_LINK_KEY)
}

export function retornoEntradaNotasValido(
  retorno: string | null | undefined
): string | null {
  if (retorno && /^\/entrada-notas\/[a-zA-Z0-9-]+$/.test(retorno)) return retorno
  return null
}
