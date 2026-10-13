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

export const OPCOES_TIPO_CONTA = [
  { value: 'bancaria', label: 'Bancária' },
  { value: 'caixa', label: 'Caixa' },
] as const

const ROTULOS_BANCO_LEGADO: Record<string, string> = {
  itau: 'Itaú',
  bradesco: 'Bradesco',
  banco_do_brasil: 'Banco do Brasil',
  santander: 'Santander',
  sicoob: 'Sicoob',
  c6: 'C6',
}

export function bancoSelecionadoBrasilApi(valor: string): boolean {
  return /^(?:\d{3}|ISPB \d+) - .+/.test(valor.trim())
}

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

export function rotuloOpcaoContaEmpresa(item: ContaEmpresaLista): string {
  if (item.tipo === 'caixa') return item.nome
  const banco = item.banco ? ROTULOS_BANCO_LEGADO[item.banco] ?? item.banco : ''
  const cc = formatarContaExibicao(item.conta, item.digitoConta)
  if (banco && cc !== '—') return `${item.nome} · ${banco} · CC ${cc}`
  return item.nome
}
