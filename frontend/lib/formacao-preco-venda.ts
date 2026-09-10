/**
 * Formação de preço de venda (grade Precificação).
 * Espelha `src/modulos/entrada-notas/formacao-preco-venda.ts` — §7.26.
 */

export const MSG_CARGA_INVALIDA =
  'Carga (encargos + vr.adic + margem) deve ser menor que 100%.'

export const MSG_CUSTO_COMERCIAL_INVALIDO = 'Custo comercial inválido.'

export type ResultadoFormacaoPreco =
  | {
      ok: true
      precoSugerido: number
      margemPercentual: number
      cargaPercentual: number
    }
  | {
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
  custoComercial: number | null | undefined,
  encargosPercentual: number,
  margemPercentual: number,
  vrAdicPercentual = 0
): ResultadoFormacaoPreco {
  if (!finitoPositivo(custoComercial)) {
    return { ok: false, motivo: MSG_CUSTO_COMERCIAL_INVALIDO }
  }
  if (!Number.isFinite(encargosPercentual) || encargosPercentual < 0) {
    return { ok: false, motivo: 'Encargos inválidos.' }
  }
  if (!Number.isFinite(vrAdicPercentual) || vrAdicPercentual < 0) {
    return { ok: false, motivo: 'Valor adicional inválido.' }
  }
  if (!Number.isFinite(margemPercentual)) {
    return { ok: false, motivo: 'Margem inválida.' }
  }
  const carga = encargosPercentual + vrAdicPercentual + margemPercentual
  if (carga >= 100) {
    return { ok: false, motivo: MSG_CARGA_INVALIDA }
  }
  const divisor = 1 - carga / 100
  if (divisor <= 0) {
    return { ok: false, motivo: MSG_CARGA_INVALIDA }
  }
  return {
    ok: true,
    precoSugerido: arred4(custoComercial / divisor),
    margemPercentual,
    cargaPercentual: carga,
  }
}

export function calcularMargemDePreco(
  custoComercial: number | null | undefined,
  encargosPercentual: number,
  precoDigitado: number,
  vrAdicPercentual = 0
): ResultadoFormacaoPreco {
  if (!finitoPositivo(custoComercial)) {
    return { ok: false, motivo: MSG_CUSTO_COMERCIAL_INVALIDO }
  }
  if (!Number.isFinite(encargosPercentual) || encargosPercentual < 0) {
    return { ok: false, motivo: 'Encargos inválidos.' }
  }
  if (!Number.isFinite(vrAdicPercentual) || vrAdicPercentual < 0) {
    return { ok: false, motivo: 'Valor adicional inválido.' }
  }
  if (!Number.isFinite(precoDigitado) || precoDigitado <= 0) {
    return { ok: false, motivo: 'Preço de venda deve ser maior que zero.' }
  }
  const margemPercentual = arred4(
    (1 - (encargosPercentual + vrAdicPercentual) / 100 - custoComercial / precoDigitado) * 100
  )
  const carga = encargosPercentual + vrAdicPercentual + margemPercentual
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

export function valorAdicionalReais(
  custoComercial: number | null | undefined,
  vrAdicPercentual: number
): number | null {
  if (custoComercial == null || !Number.isFinite(custoComercial)) return null
  if (!Number.isFinite(vrAdicPercentual)) return null
  return arred4((custoComercial * vrAdicPercentual) / 100)
}
