/**
 * Utilitários de CPF/CNPJ para o frontend.
 * Espelho do compartilhado do backend — importado diretamente para uso em componentes React.
 */

export function validarCpf(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '')
  if (nums.length !== 11) return false
  if (/^(\d)\1{10}$/.test(nums)) return false
  const calc = (base: string, peso: number) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += parseInt(base[i]) * (peso - i)
    const r = (soma * 10) % 11
    return r === 10 || r === 11 ? 0 : r
  }
  return (
    calc(nums.slice(0, 9), 10) === parseInt(nums[9]) &&
    calc(nums.slice(0, 10), 11) === parseInt(nums[10])
  )
}

export function validarCnpj(cnpj: string): boolean {
  const nums = cnpj.replace(/\D/g, '')
  if (nums.length !== 14) return false
  if (/^(\d)\1{13}$/.test(nums)) return false
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, d, i) => acc + parseInt(d) * pesos[i], 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  return (
    calc(nums.slice(0, 12), p1) === parseInt(nums[12]) &&
    calc(nums.slice(0, 13), p2) === parseInt(nums[13])
  )
}

export function mascaraCpf(valor: string): string {
  const n = valor.replace(/\D/g, '').slice(0, 11)
  if (n.length <= 3) return n
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`
}

export function mascaraCnpj(valor: string): string {
  const n = valor.replace(/\D/g, '').slice(0, 14)
  if (n.length <= 2) return n
  if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`
  if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`
  if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`
}

export function mascaraPorTipo(valor: string, tipo: 'PF' | 'PJ'): string {
  return tipo === 'PF' ? mascaraCpf(valor) : mascaraCnpj(valor)
}

/** Detecta e aplica máscara: ≤11 dígitos → CPF, >11 → CNPJ */
export function mascaraDocumento(valor: string): string {
  const n = valor.replace(/\D/g, '')
  return n.length <= 11 ? mascaraCpf(valor) : mascaraCnpj(valor)
}

/** null enquanto ambíguo (<11), 'CPF' com 11, 'CNPJ' com >11 */
export function detectarTipoDocumento(valor: string): 'CPF' | 'CNPJ' | null {
  const n = valor.replace(/\D/g, '')
  if (n.length < 11) return null
  return n.length === 11 ? 'CPF' : 'CNPJ'
}

export function mascaraTelefone(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 11)
  if (n.length <= 10)
    return n.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return n.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export function mascaraCep(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}
