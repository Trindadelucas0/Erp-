export type TipoContaEmpresa = 'bancaria' | 'caixa'

export type ContaEmpresaLista = {
  id: string
  nome: string
  tipo: TipoContaEmpresa | string
  banco: string | null
  agencia: string | null
  digitoAgencia: string | null
  conta: string | null
  digitoConta: string | null
  limiteChequeEspecial: number | null
  ativo: boolean
}

export const OPCOES_BANCO_CONTA = [
  { value: 'itau', label: 'Itaú' },
  { value: 'bradesco', label: 'Bradesco' },
  { value: 'banco_do_brasil', label: 'Banco do Brasil' },
  { value: 'santander', label: 'Santander' },
  { value: 'sicoob', label: 'Sicoob' },
  { value: 'c6', label: 'C6' },
] as const

export const OPCOES_TIPO_CONTA = [
  { value: 'bancaria', label: 'Bancária' },
  { value: 'caixa', label: 'Caixa' },
] as const

export function rotuloTipoConta(tipo: string): string {
  if (tipo === 'caixa') return 'Caixa'
  if (tipo === 'bancaria') return 'Bancária'
  return tipo
}

export function formatarAgenciaExibicao(
  agencia: string | null,
  digito: string | null
): string {
  if (!agencia?.trim()) return '—'
  return digito?.trim() ? `${agencia}-${digito}` : agencia
}

export function formatarContaExibicao(conta: string | null, digito: string | null): string {
  if (!conta?.trim()) return '—'
  return digito?.trim() ? `${conta}-${digito}` : conta
}
