/**
 * Helpers puros de paginação/ordenação da listagem de produtos.
 * Espelha o padrão da auditoria: limite whitelist + skip calculado.
 */

export const LIMITES_PAGINA_PRODUTOS = [10, 25, 50, 100] as const
export type LimitePaginaProdutos = (typeof LIMITES_PAGINA_PRODUTOS)[number]
export const LIMITE_PADRAO_PRODUTOS: LimitePaginaProdutos = 50
export const LIMITE_MAX_IDS_PRODUTOS = 200

export const CAMPOS_ORDENACAO_PRODUTOS = [
  'nomeVenda',
  'sku',
  'marca',
  'unidade',
  'ativo',
] as const
export type CampoOrdenacaoProdutos = (typeof CAMPOS_ORDENACAO_PRODUTOS)[number]
export type DirecaoOrdenacaoProdutos = 'asc' | 'desc'

export function normalizarLimiteProdutos(limite?: number): LimitePaginaProdutos {
  if (
    limite !== undefined &&
    (LIMITES_PAGINA_PRODUTOS as readonly number[]).includes(limite)
  ) {
    return limite as LimitePaginaProdutos
  }
  return LIMITE_PADRAO_PRODUTOS
}

export function normalizarPaginaProdutos(pagina?: number): number {
  if (pagina === undefined || !Number.isFinite(pagina) || pagina < 1) {
    return 1
  }
  return Math.floor(pagina)
}

export function calcularSkipProdutos(pagina: number, limite: number): number {
  return (pagina - 1) * limite
}

export function parseIdsProdutos(ids?: string | string[]): string[] {
  const bruto = Array.isArray(ids)
    ? ids
    : typeof ids === 'string'
      ? ids.split(',')
      : []
  const unicos = new Set<string>()
  for (const id of bruto) {
    const limpo = id.trim()
    if (limpo) unicos.add(limpo)
  }
  return [...unicos].slice(0, LIMITE_MAX_IDS_PRODUTOS)
}

export function normalizarOrdenacaoProdutos(
  ordenarPor?: string,
  direcao?: string
): { ordenarPor: CampoOrdenacaoProdutos; direcao: DirecaoOrdenacaoProdutos } {
  const campo = (CAMPOS_ORDENACAO_PRODUTOS as readonly string[]).includes(
    ordenarPor ?? ''
  )
    ? (ordenarPor as CampoOrdenacaoProdutos)
    : 'nomeVenda'
  const dir: DirecaoOrdenacaoProdutos = direcao === 'desc' ? 'desc' : 'asc'
  return { ordenarPor: campo, direcao: dir }
}
