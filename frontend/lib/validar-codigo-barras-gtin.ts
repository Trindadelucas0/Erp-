export const MENSAGEM_CODIGO_BARRAS_INVALIDO =
  'Código de barras inválido. Informe EAN-13 ou DUN-14 válido.'

export function normalizarCodigoBarrasGtin(valor: string): string {
  return valor.replace(/\D/g, '')
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

export function filtrarEntradaCodigoBarras(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 14)
}
