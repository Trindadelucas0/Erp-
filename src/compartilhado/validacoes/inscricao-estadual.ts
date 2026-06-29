/**
 * Normalização de Inscrição Estadual para gravação fiscal (apenas dígitos ou ISENTO).
 */
export function normalizarIe(ie?: string | null): string | null {
  if (!ie?.trim()) return null
  if (ie.trim().toUpperCase() === 'ISENTO') return 'ISENTO'
  const nums = ie.replace(/\D/g, '')
  return nums || null
}

export const IE_VALIDA_OU_ISENTO = /^(ISENTO|\d+)$/

export function resolverIndicadorIe(
  ie: string | null,
  indicadorInformado?: string | null
): string {
  if (ie === 'ISENTO') return '2'
  return indicadorInformado ?? '9'
}
