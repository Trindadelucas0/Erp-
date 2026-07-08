import type { PrazoPagamento } from '@/components/pedidos-compra/bloco-pagamento-prazos'
import { calcularDiasEntreDatas, calcularVencimentoPorDias } from '@/lib/prazos-pagamento'

export type ItemPedido = {
  id?: string
  produtoId: string
  produtoNome?: string
  produtoSku?: string | null
  codigoOriginal: string
  quantidade: string
  unidade: string
  precoUnitario: string
  percentualDesconto: string
  valorDesconto: string
  outrasDespesas: string
  previsaoEntrega: string
  origemPreco?: 'estoque' | 'historico' | ''
  total?: number
  totalLiquido?: number
}

export type PedidoCompra = {
  id: string
  numero: number
  fornecedorPessoaId: string
  fornecedorNome: string
  transportadoraPessoaId: string | null
  transportadoraNome: string | null
  modalidadeTransporte: string | null
  condicaoPagamento: string | null
  status: string
  motivoCancelamento: string | null
  descricao: string | null
  observacoes: string | null
  pedidoVendaId: string | null
  creditoFornecedorId: string | null
  creditoAplicado: number | null
  totalPedido: number
  totalLiquido: number
  createdAt: string
  itens: ItemPedido[]
}

export type ProdutoOpcao = {
  id: string
  nomeVenda: string
  sku: string | null
  urlFotoMiniatura?: string | null
  unidade: string
  codigoOrigem: string | null
  precoCusto: number | null
  bloqueadoCompra: boolean
  fornecedores: {
    fornecedorPessoaId: string
    codigoFornecedor: string | null
    unidadeEntrada: string | null
  }[]
}

export type PessoaOpcao = { id: string; nome: string }

export type EntradaFornecedor = {
  id: string
  numero: number
  descricao: string | null
  status: string
  totalLiquido: number
  data: string
  itens: number
}

export type HistoricoCompra = {
  pedidoNumero: number
  fornecedorNome: string
  data: string
  quantidade: number
  precoUnitario: number
  precoCusto: number
  status: string
}

export type PedidoVendaOpcao = {
  id: string
  numero: number
  clienteNome: string
  status: string
}

export type ContextoFornecedor = {
  pedidosAbertos: PedidoCompra[]
  creditos: { id: string; saldo: number; origem: string | null }[]
  pendencias: { id: string; tipo: string; descricao: string }[]
  ultimasEntradas: EntradaFornecedor[]
  historicoComprasProduto: HistoricoCompra[]
  prazosPagamentoFornecedor?: number[]
}

export type ModoPedidoCompra = 'novo' | 'visualizar' | 'editar'

export type FiltroStatus =
  | 'todos'
  | 'aberto'
  | 'rascunho'
  | 'enviado'
  | 'parcial'
  | 'recebido'
  | 'cancelado'

export const FILTRO_STATUS_OPCOES: { value: FiltroStatus; label: string }[] = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'aberto', label: 'Em aberto' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'parcial', label: 'Recebimento parcial' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'cancelado', label: 'Cancelado' },
]

export const AVISO_CONFERENCIA_NF =
  'Na entrada da nota fiscal, o sistema conferirá preço, prazo de pagamento e modalidade de transporte contra este pedido.'

export const MODALIDADES = [
  { value: 'FOB_NOTA', label: 'FOB, frete na nota' },
  { value: 'FOB_CONHECIMENTO', label: 'FOB, frete no conhecimento' },
  { value: 'RETIRA', label: 'Retira' },
]

export const TIPOS_COMPRA = [
  { value: 'revenda', label: 'Revenda' },
  { value: 'bonificacao', label: 'Bonificação' },
  { value: 'uso_consumo', label: 'Uso e consumo' },
]

export const AVISO_BAIXA_CREDITO_NF =
  'O valor será reservado do saldo ao salvar o pedido. A baixa definitiva ocorre na entrada da nota fiscal.'

export const TIPOS_PENDENCIA = [
  { value: 'produto_quebrado', label: 'Produto quebrado' },
  { value: 'defeito_fabrica', label: 'Defeito de fábrica' },
  { value: 'credito_pendente', label: 'Crédito pendente' },
]

export const FILTROS_VAZIOS = {
  status: 'todos' as FiltroStatus,
  fornecedorId: '',
  buscaNumero: '',
  dataInicio: '',
  dataFim: '',
}

export const itemVazio = (): ItemPedido => ({
  produtoId: '',
  codigoOriginal: '',
  quantidade: '1',
  unidade: 'UN',
  precoUnitario: '0',
  percentualDesconto: '0',
  valorDesconto: '0',
  outrasDespesas: '0',
  previsaoEntrega: '',
  origemPreco: '',
})

export const formVazio = {
  fornecedorPessoaId: '',
  transportadoraPessoaId: '',
  modalidadeTransporte: '',
  condicaoPagamento: '',
  tipoCompra: 'revenda',
  dataFaturamento: '',
  previsaoEntrega: '',
  valorFrete: '',
  valorFreteSugerido: '0',
  rateioParcelas: 'igual',
  prazos: [{ numero: 1, dias: '', vencimento: '', valor: '' }] as PrazoPagamento[],
  observacoes: '',
  observacoesInternas: '',
  pedidoVendaId: '',
  creditoFornecedorId: '',
  creditoAplicado: '',
  status: 'rascunho',
  motivoCancelamento: '',
  itens: [] as ItemPedido[],
}

export const pendenciaVazia = {
  tipo: 'produto_quebrado',
  descricao: '',
  produtoId: '',
}

export const creditoVazio = {
  valor: '',
  origem: '',
  vencimento: '',
}

export function parseNum(s: string): number {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function mapearPrazosDoPedido(
  prazos: PrazoPagamento[],
  dataFaturamento: string
): PrazoPagamento[] {
  return prazos.map((pr) => ({
    numero: pr.numero,
    vencimento: pr.vencimento,
    valor: pr.valor != null ? String(pr.valor) : '',
    dias: pr.dias ?? calcularDiasEntreDatas(dataFaturamento, pr.vencimento),
  }))
}

export function calcularTotalItem(item: ItemPedido): { bruto: number; liquido: number } {
  const q = parseNum(item.quantidade)
  const p = parseNum(item.precoUnitario)
  const bruto = Math.round(q * p * 100) / 100
  let desconto = parseNum(item.valorDesconto)
  const pct = parseNum(item.percentualDesconto)
  if (pct > 0) {
    desconto = Math.max(desconto, Math.round(bruto * (pct / 100) * 100) / 100)
  }
  const outras = parseNum(item.outrasDespesas)
  const liquido = Math.round((bruto - desconto + outras) * 100) / 100
  return { bruto, liquido }
}

export function formatarDataIso(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarData(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

export function pedidoEditavel(status: string) {
  return !['cancelado', 'recebido'].includes(status)
}

export function montarCondicaoPagamentoDePrazos(prazos: number[]): string {
  if (prazos.length === 0) return ''
  return prazos.map((d) => String(d)).join('/')
}

export function condicaoDePrazosForm(prazos: { dias?: string }[]): string {
  const dias = prazos
    .map((p) => parseInt(String(p.dias ?? '').replace(/\D/g, ''), 10))
    .filter((d) => Number.isFinite(d) && d >= 0)
  return montarCondicaoPagamentoDePrazos(dias)
}

export function prazosFornecedorParaForm(
  prazosFornecedor: number[],
  dataFaturamento: string
): PrazoPagamento[] {
  if (prazosFornecedor.length === 0) {
    return [{ numero: 1, dias: '', vencimento: '', valor: '' }]
  }
  return prazosFornecedor.map((dias, index) => ({
    numero: index + 1,
    dias: String(dias),
    vencimento: calcularVencimentoPorDias(dataFaturamento, String(dias)),
    valor: '',
  }))
}

export function aplicarPrazosFornecedorNoForm(
  prazosFornecedor: number[],
  dataFaturamento: string
): { prazos: PrazoPagamento[]; condicaoPagamento: string } {
  const prazos = prazosFornecedorParaForm(prazosFornecedor, dataFaturamento)
  return {
    prazos,
    condicaoPagamento: condicaoDePrazosForm(prazos),
  }
}
