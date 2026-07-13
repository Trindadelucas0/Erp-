/**
 * No save do produto: se a embalagem (multiplicadorEntrada) veio preenchida
 * e o múltiplo de compra está vazio, copia o valor da embalagem.
 */
export function preencherMultiploSeVazio(params: {
  multiplicadorEntrada?: number | null
  multiploEntrada?: number | null
}): { multiplicadorEntrada?: number | null; multiploEntrada?: number | null } {
  const multiplicador = params.multiplicadorEntrada
  const multiplo = params.multiploEntrada
  const multiploVazio = multiplo == null || !Number.isFinite(multiplo)
  const embalagemValida =
    multiplicador != null && Number.isFinite(multiplicador) && multiplicador > 0

  if (multiploVazio && embalagemValida) {
    return { multiplicadorEntrada: multiplicador, multiploEntrada: multiplicador }
  }
  return {
    multiplicadorEntrada: multiplicador,
    multiploEntrada: multiplo,
  }
}
