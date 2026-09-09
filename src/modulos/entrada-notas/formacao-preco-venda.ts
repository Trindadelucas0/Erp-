/**
 * Formação de preço de venda a partir do custo da entrada (grade Precificação).
 * Fonte: DOCUMENTACAO-SISTEMA.md §7.26.
 *
 * carga% = encargosVenda% + margem%
 * se carga% >= 100 → recusa
 * precoSugerido = custoEntrada / (1 − carga% / 100)
 *
 * CBS, IBS e juros mensais não entram no divisor nesta fase.
 */

export const MSG_CARGA_INVALIDA =
  'Carga (encargos + margem) deve ser menor que 100%.'

export type ResultadoFormacaoPreco = {
  ok: true
  precoSugerido: number
  margemPercentual: number
  cargaPercentual: number
} | {
  ok: false
  motivo: string
}

function finitoPositivo(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

function arred4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function calcularPrecoSugerido(
  custoEntrada: number | null | undefined,
  encargosPercentual: number,
  margemPercentual: number
): ResultadoFormacaoPreco {
  if (!finitoPositivo(custoEntrada)) {
    return { ok: false, motivo: 'Custo da entrada inválido.' }
  }
  if (!Number.isFinite(encargosPercentual) || encargosPercentual < 0) {
    return { ok: false, motivo: 'Encargos inválidos.' }
  }
  if (!Number.isFinite(margemPercentual)) {
    return { ok: false, motivo: 'Margem inválida.' }
  }
  const carga = encargosPercentual + margemPercentual
  if (carga >= 100) {
    return { ok: false, motivo: MSG_CARGA_INVALIDA }
  }
  const divisor = 1 - carga / 100
  if (divisor <= 0) {
    return { ok: false, motivo: MSG_CARGA_INVALIDA }
  }
  return {
    ok: true,
    precoSugerido: arred4(custoEntrada / divisor),
    margemPercentual,
    cargaPercentual: carga,
  }
}

/** Recalcula a margem quando o operador edita o preço sugerido. */
export function calcularMargemDePreco(
  custoEntrada: number | null | undefined,
  encargosPercentual: number,
  precoDigitado: number
): ResultadoFormacaoPreco {
  if (!finitoPositivo(custoEntrada)) {
    return { ok: false, motivo: 'Custo da entrada inválido.' }
  }
  if (!Number.isFinite(encargosPercentual) || encargosPercentual < 0) {
    return { ok: false, motivo: 'Encargos inválidos.' }
  }
  if (!Number.isFinite(precoDigitado) || precoDigitado <= 0) {
    return { ok: false, motivo: 'Preço de venda deve ser maior que zero.' }
  }
  const margemPercentual = arred4(
    (1 - encargosPercentual / 100 - custoEntrada / precoDigitado) * 100
  )
  const carga = encargosPercentual + margemPercentual
  if (carga >= 100) {
    return { ok: false, motivo: MSG_CARGA_INVALIDA }
  }
  return {
    ok: true,
    precoSugerido: arred4(precoDigitado),
    margemPercentual,
    cargaPercentual: carga,
  }
}

export function calcularDiferencaPercentualPreco(
  precoSugerido: number | null | undefined,
  precoAtual: number | null | undefined
): number | null {
  if (precoSugerido == null || !Number.isFinite(precoSugerido)) return null
  if (precoAtual == null || !Number.isFinite(precoAtual) || precoAtual === 0) return null
  return (precoSugerido - precoAtual) / precoAtual
}
