/**
 * Trava em memória: uma sync/job Focus por empresa por vez.
 */
const empresasEmAndamento = new Set<string>()

export function tentarTravarFocus(companyId: string): boolean {
  if (empresasEmAndamento.has(companyId)) return false
  empresasEmAndamento.add(companyId)
  return true
}

export function liberarTravaFocus(companyId: string): void {
  empresasEmAndamento.delete(companyId)
}

export function empresaFocusEmAndamento(companyId: string): boolean {
  return empresasEmAndamento.has(companyId)
}
