/**
 * Mapeia HTTP da Focus para resposta ao browser.
 * 401/403 upstream não podem ser repassados — o axios ERP trata 401 como logout.
 */
export function codigoHttpClienteErroFocus(codigoFocus?: number): number {
  if (codigoFocus === 429) return 429
  if (codigoFocus === 404) return 404
  if (codigoFocus === 401 || codigoFocus === 403) return 502
  if (codigoFocus != null && codigoFocus >= 400 && codigoFocus < 500) return 502
  return codigoFocus ?? 502
}
