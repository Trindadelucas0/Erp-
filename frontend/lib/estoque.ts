/** Tipos e formatadores do Kardex de Estoque. */

export type TipoEstoqueVisao = 'disponivel' | 'fisico' | 'fiscal'

export type SaldosKardex = {
  qtdFisica: number
  qtdReservada: number
  qtdBloqueada: number
  qtdFiscal: number
  qtdDisponivel: number
}

export type ProdutoKardex = {
  id: string
  sku: string | null
  nomeVenda: string
  nomeCompra: string | null
  marca: string
  unidade: string
  codigoBarras: string | null
  ncm: string | null
  codigoOrigem: string | null
  multiploVenda: number
  precoCusto: number | null
  controlaEstoque: boolean
  permiteEstoqueNegativo: boolean
  bloqueadoVenda: boolean
  ativo: boolean
}

export type FornecedorVinculoKardex = {
  id: string
  fornecedorPessoaId: string
  nome: string
  nomeFantasia: string | null
  documento: string | null
  codigoFornecedor: string | null
  unidadeEntrada: string | null
  multiploEntrada: number | null
  multiplicadorEntrada: number | null
  ordem: number
}

export type LinhaKardex = {
  id: string
  data: string
  tipo: string
  tipoMovimento: string
  movimento: string
  ocorrencia: string
  parceiroNome: string | null
  parceiroDocumento: string | null
  motivo: string | null
  qtdEntrada: number | null
  qtdSaida: number | null
  saldo: number
  precoCusto: number | null
  unidade: string
  dimensao: string
  origem: string
  origemId: string | null
  observacao: string | null
  usuarioId: string | null
  usuarioNome: string | null
  pessoaId: string | null
}

export type ResumoTipoKardex = {
  tipoMovimento: string
  tipoRotulo: string
  entradas: number
  saidas: number
  saldo: number
}

export type RespostaKardex = {
  produto: ProdutoKardex
  fornecedores: FornecedorVinculoKardex[]
  tipoEstoque: TipoEstoqueVisao
  periodo: { de: string; ate: string }
  saldos: SaldosKardex
  saldoInicial: number
  saldoFinal: number
  totais: { entrada: number; saida: number }
  linhas: LinhaKardex[]
  resumoPorTipo: ResumoTipoKardex[]
}

export function formatarQtdEstoque(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

export function formatarDataHoraKardex(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatarDataKardex(iso: string): string {
  return formatarDataHoraKardex(iso)
}

export function formatarMoedaKardex(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function inicioDoMesIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export function hojeIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const ROTULO_TIPO_ESTOQUE: Record<TipoEstoqueVisao, string> = {
  disponivel: 'Disponível',
  fisico: 'Físico',
  fiscal: 'Fiscal',
}
