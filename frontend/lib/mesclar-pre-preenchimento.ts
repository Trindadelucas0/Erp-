/**
 * Helpers para mesclar dados do pré-preenchimento (BrasilAPI ou ERP interno)
 * com o estado atual do formulário — mantendo o valor existente quando já preenchido.
 */

import { paraCaixaAlta } from './texto'

/** Usa `importado` apenas se `atual` estiver vazio. Texto importado em caixa alta. */
export function mesclarTexto(atual: string, importado: string | null | undefined): string {
  if (atual.trim()) return atual
  const texto = importado?.trim() ?? ''
  return texto ? paraCaixaAlta(texto) : ''
}

/** Usa o array `importado` apenas se `atual` estiver vazio. */
export function mesclarArray<T>(atual: T[], importado: T[] | null | undefined): T[] {
  return atual.length > 0 ? atual : (importado ?? [])
}

/** Usa `importado` apenas se `atual` for false. */
export function mesclarBoolean(atual: boolean, importado: boolean | null | undefined): boolean {
  return atual ? atual : (importado ?? false)
}
