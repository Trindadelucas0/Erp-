/**
 * Busca textual de catálogo (regra §7.11):
 * tokens por espaço → AND de todas as palavras → cada palavra com contains parcial CI.
 */

export function tokensBusca(termo: string | null | undefined): string[] {
  const t = termo?.trim()
  if (!t) return []
  return t.split(/\s+/).filter(Boolean)
}

/**
 * Monta filtro Prisma: cada token gera um OR (via `montarOrPorToken`);
 * vários tokens ficam em AND (todas as palavras obrigatórias).
 */
export function montarFiltroBuscaTextual<T extends object>(
  termo: string | null | undefined,
  montarOrPorToken: (token: string) => T
): T | { AND: T[] } | undefined {
  const tokens = tokensBusca(termo)
  if (!tokens.length) return undefined
  if (tokens.length === 1) return montarOrPorToken(tokens[0]!)
  return { AND: tokens.map((token) => montarOrPorToken(token)) }
}

const MODE_CI = 'insensitive' as const

/** Atalho: OR de `campo contains token` (case-insensitive) para campos escalares. */
export function orContainsInsensitiveCampos(
  token: string,
  campos: readonly string[]
): { OR: Array<Record<string, { contains: string; mode: 'insensitive' }>> } {
  return {
    OR: campos.map((campo) => ({
      [campo]: { contains: token, mode: MODE_CI },
    })),
  }
}

export function montarFiltroBuscaCamposEscalares(
  termo: string | null | undefined,
  campos: readonly string[]
) {
  return montarFiltroBuscaTextual(termo, (token) =>
    orContainsInsensitiveCampos(token, campos)
  )
}
