/**
 * Validação de códigos de barras GTIN (EAN-13 e DUN-14 / GTIN-14).
 */
export const MENSAGEM_CODIGO_BARRAS_INVALIDO =
  'Código de barras inválido. Informe EAN-13 ou DUN-14 válido.'

export const MENSAGEM_CODIGO_BARRAS_DUPLICADO_NO_PRODUTO =
  'Código de barras duplicado no cadastro do produto.'

export const MENSAGEM_CODIGO_BARRAS_JA_CADASTRADO =
  'Código de barras já cadastrado em outro produto.'

export function normalizarCodigoBarrasGtin(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * Variantes para busca de produto na entrada (NF ↔ cadastro).
 * - 14 dígitos (DUN-14): também tenta os últimos 13 (EAN-13 embutido).
 * - 13 dígitos: também tenta `0` + 13 (GTIN-14 com indicador 0).
 */
export function variantesCodigoBarrasParaBusca(gtin: string): string[] {
  const limpo = normalizarCodigoBarrasGtin(gtin)
  if (!limpo) return []

  const variantes: string[] = [limpo]
  if (limpo.length === 14) {
    const treze = limpo.slice(-13)
    if (treze && !variantes.includes(treze)) variantes.push(treze)
  } else if (limpo.length === 13) {
    const quatorze = `0${limpo}`
    if (!variantes.includes(quatorze)) variantes.push(quatorze)
  }
  return variantes
}

/**
 * Normaliza código original do fornecedor / cProd da NF para comparação
 * (remove `.` `-` e espaços; maiúsculas).
 */
export function normalizarCodigoOriginalComparacao(codigo: string): string {
  return codigo.trim().replace(/[.\-\s]/g, '').toUpperCase()
}

function digitoVerificadorGtinValido(digitos: string): boolean {
  const nums = digitos.split('').map(Number)
  const check = nums.pop()
  if (check === undefined || nums.some((n) => Number.isNaN(n))) return false

  let soma = 0
  for (let i = nums.length - 1; i >= 0; i--) {
    const posFromRight = nums.length - i
    soma += nums[i] * (posFromRight % 2 === 1 ? 3 : 1)
  }
  const calculado = (10 - (soma % 10)) % 10
  return calculado === check
}

export function codigoBarrasGtinValido(valor: string): boolean {
  const digitos = normalizarCodigoBarrasGtin(valor)
  if (digitos.length !== 13 && digitos.length !== 14) return false
  return digitoVerificadorGtinValido(digitos)
}

export function coletarCodigosBarrasProduto(
  codigoUnidade?: string | null,
  embalagensMaster?: { codigoBarras?: string | null }[]
): string[] {
  const codigos: string[] = []

  if (codigoUnidade) {
    const normalizado = normalizarCodigoBarrasGtin(codigoUnidade)
    if (normalizado) codigos.push(normalizado)
  }

  for (const embalagem of embalagensMaster ?? []) {
    if (!embalagem.codigoBarras) continue
    const normalizado = normalizarCodigoBarrasGtin(embalagem.codigoBarras)
    if (normalizado) codigos.push(normalizado)
  }

  return codigos
}

/** Retorna true quando não há códigos repetidos no mesmo produto. */
export function validarCodigosBarrasInternos(codigos: string[]): boolean {
  const vistos = new Set<string>()
  for (const codigo of codigos) {
    if (vistos.has(codigo)) return false
    vistos.add(codigo)
  }
  return true
}
