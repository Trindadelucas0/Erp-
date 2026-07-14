/**
 * Regras de sincronização entre quantidade por embalagem (entrada)
 * e múltiplo de compra no vínculo produto–fornecedor.
 *
 * No formulário os campos são independentes (sem espelhamento ao digitar).
 * No save/API, múltiplo vazio ainda pode ser preenchido a partir da embalagem.
 */

/**
 * No save/API: só preenche múltiplo quando vier vazio e a embalagem estiver definida.
 * Não sobrescreve múltiplo já informado.
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
