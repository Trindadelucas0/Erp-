/**
 * Regras de sincronização entre quantidade por embalagem (entrada)
 * e múltiplo de compra no vínculo produto–fornecedor.
 */

export function parseDecimalFormulario(valor: string): number | null {
  const limpo = valor.trim().replace(/\./g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

function multiploEstaVazio(multiploEntrada: string): boolean {
  return parseDecimalFormulario(multiploEntrada) == null
}

function valoresNumericosIguais(a: string, b: string): boolean {
  const na = parseDecimalFormulario(a)
  const nb = parseDecimalFormulario(b)
  if (na == null || nb == null) return false
  return Math.abs(na - nb) < 1e-9
}

/**
 * Ao digitar a embalagem no formulário:
 * - se o múltiplo estiver vazio, preenche com a embalagem
 * - se o múltiplo ainda espelhava a embalagem anterior, acompanha o novo valor
 * - se o usuário já customizou o múltiplo, não sobrescreve
 * Limpar a embalagem não apaga o múltiplo.
 */
export function aplicarEmbalagemNoFormularioFornecedor(params: {
  multiplicadorEntradaAnterior: string
  multiplicadorEntrada: string
  multiploEntradaAtual: string
}): { multiplicadorEntrada: string; multiploEntrada: string } {
  const multiplicadorEntrada = params.multiplicadorEntrada
  const n = parseDecimalFormulario(multiplicadorEntrada)
  if (n == null || n <= 0) {
    return {
      multiplicadorEntrada,
      multiploEntrada: params.multiploEntradaAtual,
    }
  }

  const deveSincronizar =
    multiploEstaVazio(params.multiploEntradaAtual) ||
    valoresNumericosIguais(params.multiploEntradaAtual, params.multiplicadorEntradaAnterior)

  return {
    multiplicadorEntrada,
    multiploEntrada: deveSincronizar ? multiplicadorEntrada : params.multiploEntradaAtual,
  }
}

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
