/**
 * Utilitários de validação e formatação de documentos (CPF e CNPJ).
 * Centralizado aqui para ser reutilizado por todos os módulos do sistema.
 */

// ─── Validação ────────────────────────────────────────────────────────────────

export function validarCpf(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '')
  if (nums.length !== 11) return false
  if (/^(\d)\1{10}$/.test(nums)) return false

  const calc = (base: string, peso: number) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i]) * (peso - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 || resto === 11 ? 0 : resto
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
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  return (
    calc(nums.slice(0, 12), p1) === parseInt(nums[12]) &&
    calc(nums.slice(0, 13), p2) === parseInt(nums[13])
  )
}

// ─── Máscaras ─────────────────────────────────────────────────────────────────

/** Formata CPF: "00000000000" → "000.000.000-00" */
export function mascaraCpf(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11)
  if (nums.length <= 3) return nums
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`
}

/** Formata CNPJ: "00000000000000" → "00.000.000/0000-00" */
export function mascaraCnpj(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 14)
  if (nums.length <= 2) return nums
  if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`
  if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`
  if (nums.length <= 12) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`
  return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`
}

/**
 * Detecta o tipo pelo número de dígitos e aplica a máscara correta.
 * Até 11 dígitos → CPF. A partir de 12 → CNPJ.
 */
export function mascaraDocumento(valor: string): string {
  const nums = valor.replace(/\D/g, '')
  return nums.length <= 11 ? mascaraCpf(valor) : mascaraCnpj(valor)
}

// ─── Detecção de tipo ─────────────────────────────────────────────────────────

/**
 * Detecta o tipo do documento com base nos dígitos digitados.
 * Retorna null enquanto o número de dígitos for ambíguo (menos de 11).
 */
export function detectarTipoDocumento(valor: string): 'CPF' | 'CNPJ' | null {
  const nums = valor.replace(/\D/g, '')
  if (nums.length <= 11) return nums.length === 11 ? 'CPF' : null
  return 'CNPJ'
}
