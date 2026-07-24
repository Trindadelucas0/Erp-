/**
 * Utilitários de CPF/CNPJ para o frontend.
 * Espelho do compartilhado do backend — importado diretamente para uso em componentes React.
 *
 * CNPJ: aceita numérico e alfanumérico (Receita Federal / IN 2.229).
 * CPF: permanece somente numérico.
 */

export function normalizarCpf(valor: string): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, 11)
}

/** CNPJ: maiúsculas + A-Z/0-9 (máx. 14). Numérico e alfanumérico. */
export function normalizarCnpj(valor: string): string {
  return String(valor ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 14)
}

/** Campo unificado / documento favorecido. */
export function normalizarDocumento(valor: string): string {
  const limpo = String(valor ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
  if (/[A-Z]/.test(limpo) || limpo.length > 11) return limpo.slice(0, 14)
  return limpo.slice(0, 11)
}

export function validarCpf(cpf: string): boolean {
  const nums = normalizarCpf(cpf)
  if (nums.length !== 11) return false
  if (/^(\d)\1{10}$/.test(nums)) return false
  const calc = (base: string, peso: number) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * (peso - i)
    const r = (soma * 10) % 11
    return r === 10 || r === 11 ? 0 : r
  }
  return (
    calc(nums.slice(0, 9), 10) === parseInt(nums[9], 10) &&
    calc(nums.slice(0, 10), 11) === parseInt(nums[10], 10)
  )
}

function valorCnpj(c: string): number {
  return c.charCodeAt(0) - 48
}

export function validarCnpj(cnpj: string): boolean {
  const limpo = normalizarCnpj(cnpj)
  if (limpo.length !== 14) return false
  if (!/^[0-9]{2}$/.test(limpo.slice(12))) return false
  if (/^(.)\1{13}$/.test(limpo)) return false

  const calc = (base: string, pesos: number[]) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += valorCnpj(base[i]) * pesos[i]
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  return (
    calc(limpo.slice(0, 12), p1) === parseInt(limpo[12], 10) &&
    calc(limpo.slice(0, 13), p2) === parseInt(limpo[13], 10)
  )
}

export function mascaraCpf(valor: string): string {
  const n = normalizarCpf(valor)
  if (n.length <= 3) return n
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`
}

export function mascaraCnpj(valor: string): string {
  const n = normalizarCnpj(valor)
  if (n.length <= 2) return n
  if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`
  if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`
  if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`
}

export function mascaraPorTipo(valor: string, tipo: 'PF' | 'PJ'): string {
  return tipo === 'PF' ? mascaraCpf(valor) : mascaraCnpj(valor)
}

/** Detecta e aplica máscara: letras ou >11 → CNPJ; senão CPF */
export function mascaraDocumento(valor: string): string {
  const limpo = String(valor ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
  if (/[A-Z]/.test(limpo) || limpo.length > 11) return mascaraCnpj(valor)
  return mascaraCpf(valor)
}

/** null enquanto ambíguo (<11 sem letras), 'CPF' com 11 dígitos, 'CNPJ' com letras ou >11 */
export function detectarTipoDocumento(valor: string): 'CPF' | 'CNPJ' | null {
  const limpo = String(valor ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
  if (/[A-Z]/.test(limpo)) return 'CNPJ'
  if (limpo.length < 11) return null
  return limpo.length === 11 ? 'CPF' : 'CNPJ'
}

/** Classifica documento completo para payload/busca. */
export function classificarDocumento(
  valor: string
): { tipo: 'CPF'; valor: string } | { tipo: 'CNPJ'; valor: string } | null {
  const limpo = String(valor ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
  if (/[A-Z]/.test(limpo) || limpo.length > 11) {
    const cnpj = limpo.slice(0, 14)
    return cnpj.length === 14 ? { tipo: 'CNPJ', valor: cnpj } : null
  }
  const cpf = limpo.slice(0, 11)
  return cpf.length === 11 ? { tipo: 'CPF', valor: cpf } : null
}

export function mascaraTelefone(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 11)
  if (n.length === 0) return ''
  if (n.length <= 2) return `(${n}`
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
}

export function mascaraCep(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

/** Remove pontos, traços e demais caracteres — mantém só dígitos (cola do site do governo). */
export function sanitizarIeDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}
