export type TipoContaPagar = 'duplicata' | 'tributos'
export type TipoTributo = 'darf_simples' | 'darf_normal' | 'gps'
export type PlanoFinanceiroOpcao = { id: string; nome: string; codigo?: string }

export type ContaPagarLista = {
  id: string
  codigo: string
  codigoExibicao?: string
  tipo: TipoContaPagar | string
  tipoTributo: TipoTributo | string | null
  codigoReceita: string | null
  numeroReferencia: string | null
  pessoaId: string | null
  pessoa: {
    id: string
    nome: string
    nomeFantasia: string | null
    documento: string | null
  } | null
  planoFinanceiroId: string | null
  planoFinanceiro: { id: string; codigo: string; nome: string } | null
  origem: string
  nfeRecebidaId?: string | null
  despesaEntradaId?: string | null
  numeroDocumento: string | null
  dataEmissao: string | null
  dataCadastro: string
  vencimento: string | null
  status: string
  valorTotal: number
  valorDesconto: number
  valorJuros: number
  valorMulta: number
  valorImpostoRetido: number
  valorLiquido: number
  saldoDevedor?: number
  valorPagoPrincipal?: number
  totalJurosBaixas?: number
  totalMultaBaixas?: number
  parcelaId?: string | null
  observacao: string | null
  parcelas?: Array<{
    id: string
    numeroParcela: number
    numeroDocumento: string | null
    vencimento: string
    valor: number
    valorPago: number
    saldoDevedor: number
    status: string
    baixas?: ContaPagarBaixaItem[]
  }>
  baixas?: ContaPagarBaixaItem[]
  createdAt: string
  updatedAt: string
}

export type ContaPagarBaixaItem = {
  id: string
  pagoEm: string
  valorPrincipal: number
  valorJuros: number
  valorMulta: number
  valorDesconto: number
  valorTotalPago: number
  observacao: string | null
  createdAt: string
  usuario: { id: string; name: string } | null
  numeroParcela?: number
  parcelaId?: string
}

export type HistoricoBaixaLista = ContaPagarBaixaItem & {
  contaPagarId: string
  codigo: string
  codigoExibicao?: string
  numeroDocumento: string | null
  pessoa: ContaPagarLista['pessoa']
  origem: string
  statusConta: string
  valorTotalTitulo: number
  valorPagoPrincipalTitulo: number
  saldoDevedorTitulo: number
  totalJurosBaixas: number
  totalMultaBaixas: number
}

export type FormContaPagar = {
  tipo: TipoContaPagar
  tipoTributo: TipoTributo | ''
  codigoReceita: string
  numeroReferencia: string
  pessoaId: string
  planoFinanceiroId: string
  numeroDocumento: string
  dataEmissao: string
  vencimento: string
  valorTotal: string
  valorDesconto: string
  valorJuros: string
  valorMulta: string
  valorImpostoRetido: string
  observacao: string
}

export const OPCOES_TIPO_CONTA: { value: TipoContaPagar; label: string }[] = [
  { value: 'duplicata', label: 'Duplicata' },
  { value: 'tributos', label: 'Tributos' },
]

export const OPCOES_TIPO_TRIBUTO: { value: TipoTributo; label: string }[] = [
  { value: 'darf_simples', label: 'DARF Simples' },
  { value: 'darf_normal', label: 'DARF Normal' },
  { value: 'gps', label: 'GPS' },
]

export function formContaPagarVazio(): FormContaPagar {
  const hoje = new Date()
  const iso = hoje.toISOString().slice(0, 10)
  return {
    tipo: 'duplicata',
    tipoTributo: '',
    codigoReceita: '',
    numeroReferencia: '',
    pessoaId: '',
    planoFinanceiroId: '',
    numeroDocumento: '',
    dataEmissao: iso,
    vencimento: '',
    valorTotal: '',
    valorDesconto: '0',
    valorJuros: '0',
    valorMulta: '0',
    valorImpostoRetido: '0',
    observacao: '',
  }
}

export function contaParaForm(conta: ContaPagarLista): FormContaPagar {
  return {
    tipo: (conta.tipo === 'tributos' ? 'tributos' : 'duplicata') as TipoContaPagar,
    tipoTributo: (conta.tipoTributo as TipoTributo | null) ?? '',
    codigoReceita: conta.codigoReceita ?? '',
    numeroReferencia: conta.numeroReferencia ?? '',
    pessoaId: conta.pessoaId ?? '',
    planoFinanceiroId: conta.planoFinanceiroId ?? '',
    numeroDocumento: conta.numeroDocumento ?? '',
    dataEmissao: conta.dataEmissao ? conta.dataEmissao.slice(0, 10) : '',
    vencimento: conta.vencimento ? conta.vencimento.slice(0, 10) : '',
    valorTotal: String(conta.valorTotal ?? ''),
    valorDesconto: String(conta.valorDesconto ?? 0),
    valorJuros: String(conta.valorJuros ?? 0),
    valorMulta: String(conta.valorMulta ?? 0),
    valorImpostoRetido: String(conta.valorImpostoRetido ?? 0),
    observacao: conta.observacao ?? '',
  }
}

export function rotuloOrigemContaPagar(origem: string): string {
  if (origem === 'nfe') return 'NFe'
  if (origem === 'cte') return 'CT-e'
  if (origem === 'manual') return 'Manual'
  return origem
}

export const OPCOES_ORIGEM_CONTA: { value: string; label: string }[] = [
  { value: '', label: 'Todas as origens' },
  { value: 'manual', label: 'Manual' },
  { value: 'nfe', label: 'NFe' },
  { value: 'cte', label: 'CT-e' },
]

export function rotuloTipo(tipo: string): string {
  if (tipo === 'tributos') return 'Tributos'
  if (tipo === 'duplicata') return 'Duplicata'
  return tipo
}

export function rotuloStatusContaPagar(status: string): string {
  if (status === 'aberto') return 'Aberto'
  if (status === 'parcial') return 'Parcial'
  if (status === 'pago') return 'Pago'
  if (status === 'cancelado') return 'Cancelado'
  return status
}

export type VarianteStatusContaPagar =
  | 'ativo'
  | 'inativo'
  | 'info'
  | 'pendente'
  | 'reprovado'
  | 'aguardando'
  | 'sucesso'

export function varianteStatusContaPagar(status: string): VarianteStatusContaPagar {
  if (status === 'aberto') return 'aguardando'
  if (status === 'parcial') return 'pendente'
  if (status === 'pago') return 'sucesso'
  if (status === 'cancelado') return 'inativo'
  return 'info'
}

export function classeLinhaStatusContaPagar(status: string, vencido: boolean): string {
  if (status === 'pago') return 'bg-emerald-500/5 hover:bg-emerald-500/10'
  if (status === 'cancelado') return 'bg-muted/40 text-muted-foreground hover:bg-muted/50'
  if (status === 'parcial') return 'bg-amber-500/5 hover:bg-amber-500/10'
  if (vencido) return 'bg-destructive/5 hover:bg-destructive/10'
  return 'hover:bg-muted/40'
}

export function diasAteVencimento(iso: string | null | undefined): number | null {
  if (!iso) return null
  const v = new Date(iso)
  if (Number.isNaN(v.getTime())) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  v.setHours(0, 0, 0, 0)
  return Math.round((v.getTime() - hoje.getTime()) / 86400000)
}

export function tituloVencido(status: string, vencimento: string | null | undefined): boolean {
  if (status === 'pago' || status === 'cancelado') return false
  const dias = diasAteVencimento(vencimento)
  return dias != null && dias < 0
}

export const OPCOES_STATUS_CONTA: { value: string; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' },
  { value: 'cancelado', label: 'Cancelado' },
]

export function rotuloTipoTributo(tipo: string | null): string {
  if (!tipo) return '—'
  const op = OPCOES_TIPO_TRIBUTO.find((o) => o.value === tipo)
  return op?.label ?? tipo
}

export function formatarCodigoContaPagar(codigo: string): string {
  const n = Number(String(codigo).replace(/\D/g, ''))
  if (!Number.isFinite(n) || n <= 0) return codigo
  return n.toLocaleString('pt-BR')
}

export function formatarMoedaBr(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarDataBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function parseDinheiro(texto: string): number {
  const t = texto.trim().replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

export function validarFormContaPagar(form: FormContaPagar): string | null {
  if (!form.vencimento) return 'Data de vencimento é obrigatória'
  if (form.tipo === 'tributos' && !form.tipoTributo) {
    return 'Tipo de tributo é obrigatório quando o tipo é Tributos'
  }
  const valor = parseDinheiro(form.valorTotal)
  if (!Number.isFinite(valor) || valor <= 0) return 'Informe o valor do documento'
  return null
}

export function formParaPayload(form: FormContaPagar) {
  return {
    tipo: form.tipo,
    tipoTributo: form.tipo === 'tributos' ? form.tipoTributo || null : null,
    codigoReceita: form.tipo === 'tributos' ? form.codigoReceita.trim() || null : null,
    numeroReferencia: form.tipo === 'tributos' ? form.numeroReferencia.trim() || null : null,
    pessoaId: form.pessoaId || null,
    planoFinanceiroId: form.planoFinanceiroId || null,
    numeroDocumento: form.numeroDocumento.trim() || null,
    dataEmissao: form.dataEmissao || null,
    vencimento: form.vencimento,
    valorTotal: parseDinheiro(form.valorTotal),
    valorDesconto: parseDinheiro(form.valorDesconto) || 0,
    valorJuros: parseDinheiro(form.valorJuros) || 0,
    valorMulta: parseDinheiro(form.valorMulta) || 0,
    valorImpostoRetido: parseDinheiro(form.valorImpostoRetido) || 0,
    observacao: form.observacao.trim() || null,
  }
}
