import { paginaPossuiAbasNoCatalogo } from './registro-de-abas.js'

export function montarAbasPorPaginaDaUniao(
  linhas: Array<{ pageKey: string; tabKey: string }>
): Record<string, string[]> {
  const mapa: Record<string, Set<string>> = {}

  for (const linha of linhas) {
    if (!mapa[linha.pageKey]) mapa[linha.pageKey] = new Set()
    mapa[linha.pageKey].add(linha.tabKey)
  }

  const resultado: Record<string, string[]> = {}
  for (const [pageKey, set] of Object.entries(mapa)) {
    if (paginaPossuiAbasNoCatalogo(pageKey)) {
      resultado[pageKey] = [...set]
    }
  }
  return resultado
}
