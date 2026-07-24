/**
 * Utilitários de validação e formatação de documentos (CPF e CNPJ).
 * Centralizado aqui para ser reutilizado por todos os módulos do sistema.
 *
 * CNPJ: aceita numérico e alfanumérico (Receita Federal / IN 2.229).
 * CPF: permanece somente numérico.
 */

// ─── Normalização ─────────────────────────────────────────────────────────────

/** CPF: mantém só dígitos (máx. 11). */
export function normalizarCpf(valor: string): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, 11)
}

/**
 * CNPJ: maiúsculas + remove tudo que não for A-Z/0-9 (máx. 14).
 * Cobre CNPJ numérico e alfanumérico.
 */
export function normalizarCnpj(valor: string): string {
  return String(valor ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 14)
}

/**
 * Documento favorecido / campo unificado: se parece CNPJ (≥12 alfanuméricos
 * ou contém letra), normaliza como CNPJ; senão como CPF.
 */
export function normalizarDocumento(valor: string): string {
  const limpo = String(valor ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
  if (/[A-Z]/.test(limpo) || limpo.length > 11) return limpo.slice(0, 14)
  return limpo.slice(0, 11)
}

// ─── Validação ────────────────────────────────────────────────────────────────

export function validarCpf(cpf: string): boolean {
  const nums = normalizarCpf(cpf)
  if (nums.length !== 11) return false
  if (/^(\d)\1{10}$/.test(nums)) return false

  const calc = (base: string, peso: number) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i], 10) * (peso - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 || resto === 11 ? 0 : resto
  }

  return (
    calc(nums.slice(0, 9), 10) === parseInt(nums[9], 10) &&
    calc(nums.slice(0, 10), 11) === parseInt(nums[10], 10)
  )
}

/** Valor do caractere no cálculo do DV (ASCII − 48). Números e letras A-Z. */
function valorCnpj(c: string): number {
  return c.charCodeAt(0) - 48
}

/**
 * Valida CNPJ numérico ou alfanumérico (14 posições; DV numérico; módulo 11).
 */
export function validarCnpj(cnpj: string): boolean {
  const limpo = normalizarCnpj(cnpj)
  if (limpo.length !== 14) return false
  if (!/^[0-9]{2}$/.test(limpo.slice(12))) return false
  if (/^(.)\1{13}$/.test(limpo)) return false

  const calc = (base: string, pesos: number[]) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += valorCnpj(base[i]) * pesos[i]
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  return (
    calc(limpo.slice(0, 12), p1) === parseInt(limpo[12], 10) &&
    calc(limpo.slice(0, 13), p2) === parseInt(limpo[13], 10)
  )
}

// ─── Máscaras ─────────────────────────────────────────────────────────────────

/** Formata CPF: "00000000000" → "000.000.000-00" */
export function mascaraCpf(valor: string): string {
  const nums = normalizarCpf(valor)
  if (nums.length <= 3) return nums
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`
}

/** Formata CNPJ (numérico ou alfanumérico): "AA.AAA.AAA/AAAA-DV" */
export function mascaraCnpj(valor: string): string {
  const n = normalizarCnpj(valor)
  if (n.length <= 2) return n
  if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`
  if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`
  if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`
}

/**
 * Detecta o tipo e aplica a máscara.
 * Letras ou >11 alfanuméricos → CNPJ; senão CPF.
 */
export function mascaraDocumento(valor: string): string {
  const limpo = String(valor ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
  if (/[A-Z]/.test(limpo) || limpo.length > 11) return mascaraCnpj(valor)
  return mascaraCpf(valor)
}

// ─── Detecção de tipo ─────────────────────────────────────────────────────────

/**
 * Detecta o tipo do documento digitado.
 * Letras → CNPJ; 11 só dígitos → CPF; >11 → CNPJ; <11 sem letras → null.
 */
export function detectarTipoDocumento(valor: string): 'CPF' | 'CNPJ' | null {
  const limpo = String(valor ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
  if (/[A-Z]/.test(limpo)) return 'CNPJ'
  if (limpo.length < 11) return null
  return limpo.length === 11 ? 'CPF' : 'CNPJ'
}

/**
 * Classifica documento completo para busca/persistência.
 * Retorna null se tamanho não for CPF(11) nem CNPJ(14).
 */
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
