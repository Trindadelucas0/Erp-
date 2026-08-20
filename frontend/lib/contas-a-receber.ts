export type TipoContaReceber = 'duplicata' | 'credito'

export type ContaReceberLista = {
  id: string
  codigo: string
  codigoExibicao?: string
  tipo: TipoContaReceber | string
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
  numeroDocumento: string | null
  dataEmissao: string | null
  dataCadastro: string
  vencimento: string | null
  status: string
  valorTotal: number
  valorDesconto: number
  valorJuros: number
  valorMulta: number
  valorComissao: number
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
    baixas?: ContaReceberBaixaItem[]
  }>
  baixas?: ContaReceberBaixaItem[]
  createdAt: string
  updatedAt: string
}

export type ContaReceberBaixaItem = {
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

export type HistoricoBaixaLista = ContaReceberBaixaItem & {
  contaReceberId: string
  codigo: string
  codigoExibicao?: string
  numeroDocumento: string | null
  pessoa: ContaReceberLista['pessoa']
  origem: string
  statusConta: string
  valorTotalTitulo: number
  valorPagoPrincipalTitulo: number
  saldoDevedorTitulo: number
  totalJurosBaixas: number
  totalMultaBaixas: number
}

export type FormContaReceber = {
  tipo: TipoContaReceber
  pessoaId: string
  planoFinanceiroId: string
  numeroDocumento: string
  dataEmissao: string
  vencimento: string
  valorTotal: string
  valorDesconto: string
  valorJuros: string
  valorMulta: string
  valorComissao: string
  observacao: string
}

export const OPCOES_TIPO_CONTA_RECEBER: { value: TipoContaReceber; label: string }[] = [
  { value: 'duplicata', label: 'Duplicata' },
  { value: 'credito', label: 'Crédito' },
]

export function formContaReceberVazio(): FormContaReceber {
  const hoje = new Date()
  const iso = hoje.toISOString().slice(0, 10)
  return {
    tipo: 'duplicata',
    pessoaId: '',
    planoFinanceiroId: '',
    numeroDocumento: '',
    dataEmissao: iso,
    vencimento: '',
    valorTotal: '',
    valorDesconto: '0',
    valorJuros: '0',
    valorMulta: '0',
    valorComissao: '0',
    observacao: '',
  }
}

export function contaParaForm(conta: ContaReceberLista): FormContaReceber {
  return {
    tipo: (conta.tipo === 'credito' ? 'credito' : 'duplicata') as TipoContaReceber,
    pessoaId: conta.pessoaId ?? '',
    planoFinanceiroId: conta.planoFinanceiroId ?? '',
    numeroDocumento: conta.numeroDocumento ?? '',
    dataEmissao: conta.dataEmissao ? conta.dataEmissao.slice(0, 10) : '',
    vencimento: conta.vencimento ? conta.vencimento.slice(0, 10) : '',
    valorTotal: String(conta.valorTotal ?? ''),
    valorDesconto: String(conta.valorDesconto ?? 0),
    valorJuros: String(conta.valorJuros ?? 0),
    valorMulta: String(conta.valorMulta ?? 0),
    valorComissao: String(conta.valorComissao ?? 0),
    observacao: conta.observacao ?? '',
  }
}

export function rotuloOrigemContaReceber(origem: string): string {
  if (origem === 'manual') return 'Manual'
  return origem
}

export function rotuloTipo(tipo: string): string {
  if (tipo === 'credito') return 'Crédito'
  if (tipo === 'duplicata') return 'Duplicata'
  return tipo
}

export function rotuloStatusContaReceber(status: string): string {
  if (status === 'aberto') return 'Aberto'
  if (status === 'parcial') return 'Parcial'
  if (status === 'pago') return 'Recebido'
  if (status === 'cancelado') return 'Cancelado'
  return status
}

export type VarianteStatusContaReceber =
  | 'ativo'
  | 'inativo'
  | 'info'
  | 'pendente'
  | 'reprovado'
  | 'aguardando'
  | 'sucesso'

export function varianteStatusContaReceber(status: string): VarianteStatusContaReceber {
  if (status === 'aberto') return 'aguardando'
  if (status === 'parcial') return 'pendente'
  if (status === 'pago') return 'sucesso'
  if (status === 'cancelado') return 'inativo'
  return 'info'
}

export function classeLinhaStatusContaReceber(status: string, vencido: boolean): string {
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

export const OPCOES_STATUS_CONTA_RECEBER: { value: string; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Recebido' },
  { value: 'cancelado', label: 'Cancelado' },
]

export function formatarCodigoContaReceber(codigo: string): string {
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

export function valorLiquidoForm(form: FormContaReceber): number {
  const total = parseDinheiro(form.valorTotal)
  const desconto = parseDinheiro(form.valorDesconto) || 0
  if (!Number.isFinite(total)) return 0
  return Math.max(0, Math.round((total - desconto) * 100) / 100)
}

export function validarFormContaReceber(form: FormContaReceber): string | null {
  if (!form.vencimento) return 'Data de vencimento é obrigatória'
  const valor = parseDinheiro(form.valorTotal)
  if (!Number.isFinite(valor) || valor <= 0) return 'Informe o valor do documento'
  return null
}

export function formParaPayload(form: FormContaReceber) {
  return {
    tipo: form.tipo,
    pessoaId: form.pessoaId || null,
    planoFinanceiroId: form.planoFinanceiroId || null,
    numeroDocumento: form.numeroDocumento.trim() || null,
    dataEmissao: form.dataEmissao || null,
    vencimento: form.vencimento,
    valorTotal: parseDinheiro(form.valorTotal),
    valorDesconto: parseDinheiro(form.valorDesconto) || 0,
    valorJuros: parseDinheiro(form.valorJuros) || 0,
    valorMulta: parseDinheiro(form.valorMulta) || 0,
    valorComissao: parseDinheiro(form.valorComissao) || 0,
    observacao: form.observacao.trim() || null,
  }
}
