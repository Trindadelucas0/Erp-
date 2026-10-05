export type ParametroBoletoListaItem = {
  id: string
  nome: string
  banco: string | null
  ambiente: string | null
  padrao: boolean
  ativo: boolean
  ultimoTesteEm: string | null
  ultimoTesteSucesso: boolean | null
}

const ROTULOS_BANCO: Record<string, string> = {
  itau: 'Itaú',
  bradesco: 'Bradesco',
  banco_do_brasil: 'Banco do Brasil',
  santander: 'Santander',
  sicoob: 'Sicoob',
  c6: 'C6',
}

const ROTULOS_AMBIENTE: Record<string, string> = {
  producao: 'Produção',
  homologacao: 'Homologação',
}

export function rotuloBancoParametro(codigo: string | null | undefined): string {
  if (!codigo) return '—'
  return ROTULOS_BANCO[codigo] ?? codigo
}

export function rotuloAmbienteParametro(codigo: string | null | undefined): string {
  if (!codigo) return '—'
  return ROTULOS_AMBIENTE[codigo] ?? codigo
}
