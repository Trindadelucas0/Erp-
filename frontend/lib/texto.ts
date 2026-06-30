/**
 * Normaliza texto de cadastro para caixa alta no frontend (ex.: preenchimento ViaCEP).
 */
export function paraCaixaAlta(valor: string): string {
  const texto = valor.trim()
  if (!texto) return ''
  return texto.toUpperCase()
}
