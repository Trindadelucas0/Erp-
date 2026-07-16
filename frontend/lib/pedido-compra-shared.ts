import type { PrazoPagamento } from '@/components/pedidos-compra/bloco-pagamento-prazos'
import { calcularDiasEntreDatas, calcularVencimentoPorDias } from '@/lib/prazos-pagamento'

export type ItemPedido = {
  id?: string
  produtoId: string
  produtoNome?: string
  produtoSku?: string | null
  produtoMarca?: string | null
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
  marca: string
  unidade: string
  codigoBarras?: string | null
  codigosBarrasEmbalagem?: (string | null)[]
  codigoOrigem: string | null
  precoCusto: number | null
  bloqueadoCompra: boolean
  embalagensMaster?: { quantidade: number | null }[]
  fornecedores: {
    fornecedorPessoaId: string
    codigoFornecedor: string | null
    unidadeEntrada: string | null
    multiploEntrada: number | null
    multiplicadorEntrada: number | null
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

export type ContextoFornecedor = {
  pedidosAbertos: PedidoCompra[]
  creditos: { id: string; saldo: number; origem: string | null }[]
  pendencias: { id: string; tipo: string; descricao: string }[]
  ultimasEntradas: EntradaFornecedor[]
  historicoComprasProduto: HistoricoCompra[]
  prazosPagamentoFornecedor?: number[]
  modalidadeTransportePadrao?: string | null
}

export type ModoPedidoCompra = 'novo' | 'visualizar' | 'editar'

export type StatusPedidoFiltravel =
  | 'rascunho'
  | 'enviado'
  | 'aprovado'
  | 'parcial'
  | 'recebido'
  | 'cancelado'

export const STATUS_PEDIDO_FILTRAVEL = [
  { value: 'rascunho' as const, label: 'Rascunho' },
  { value: 'enviado' as const, label: 'Enviado' },
  { value: 'aprovado' as const, label: 'Aprovado' },
  { value: 'parcial' as const, label: 'Recebimento parcial' },
  { value: 'recebido' as const, label: 'Recebido' },
  { value: 'cancelado' as const, label: 'Cancelado' },
]

export const STATUS_FILTRO_PADRAO: StatusPedidoFiltravel[] = [
  'rascunho',
  'enviado',
  'aprovado',
  'parcial',
]

export const TODOS_STATUS_PEDIDO_FILTRAVEL: StatusPedidoFiltravel[] =
  STATUS_PEDIDO_FILTRAVEL.map((s) => s.value)

export function statusesIguais(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const conjuntoB = new Set(b)
  return a.every((status) => conjuntoB.has(status))
}

export function rotuloResumoStatusFiltro(statuses: readonly string[]): string {
  if (statuses.length === 0) return 'Nenhum status'
  if (statuses.length === TODOS_STATUS_PEDIDO_FILTRAVEL.length) return 'Todos os status'

  const rotulos = statuses
    .map((status) => STATUS_PEDIDO_FILTRAVEL.find((s) => s.value === status)?.label)
    .filter((label): label is string => !!label)

  if (rotulos.length <= 2) return rotulos.join(', ')
  return `${rotulos.slice(0, 2).join(', ')} +${rotulos.length - 2}`
}

export type FiltrosPedidoCompra = {
  statuses: StatusPedidoFiltravel[]
  fornecedorId: string
  buscaNumero: string
  dataInicio: string
  dataFim: string
}

export function filtrosDiferentesDoPadrao(filtros: FiltrosPedidoCompra): boolean {
  return (
    !statusesIguais(filtros.statuses, STATUS_FILTRO_PADRAO) ||
    filtros.fornecedorId !== '' ||
    filtros.buscaNumero.trim() !== '' ||
    filtros.dataInicio !== '' ||
    filtros.dataFim !== ''
  )
}

export type FiltroStatus =
  | 'todos'
  | 'aberto'
  | 'rascunho'
  | 'enviado'
  | 'aprovado'
  | 'parcial'
  | 'recebido'
  | 'cancelado'

export const FILTRO_STATUS_OPCOES: { value: FiltroStatus; label: string }[] = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'aberto', label: 'Em aberto' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'parcial', label: 'Recebimento parcial' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'cancelado', label: 'Cancelado' },
]

export const AVISO_CONFERENCIA_NF =
  'Na entrada da nota fiscal, o sistema conferirá preço, prazo de pagamento e modalidade de transporte contra este pedido.'

export const MODALIDADES_TRANSPORTE = ['FOB_NOTA', 'FOB_CONHECIMENTO', 'CIF'] as const
export type ModalidadeTransporte = (typeof MODALIDADES_TRANSPORTE)[number]

export const MODALIDADES = [
  { value: 'FOB_NOTA', label: 'FOB, frete na nota' },
  { value: 'FOB_CONHECIMENTO', label: 'FOB, frete no conhecimento' },
  { value: 'CIF', label: 'CIF' },
] as const

export function exigeDadosTransporte(modalidade: string): boolean {
  return modalidade === 'FOB_NOTA' || modalidade === 'FOB_CONHECIMENTO'
}

export function normalizarModalidadeTransporte(modalidade: string | null | undefined): string {
  if (!modalidade) return ''
  if (modalidade === 'RETIRA') return 'CIF'
  return modalidade
}

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

export const FILTROS_VAZIOS: FiltrosPedidoCompra = {
  statuses: [...STATUS_FILTRO_PADRAO],
  fornecedorId: '',
  buscaNumero: '',
  dataInicio: '',
  dataFim: '',
}

export const itemVazio = (): ItemPedido => ({
  produtoId: '',
  codigoOriginal: '',
  quantidade: '1',
  unidade: '',
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
  creditoFornecedorId: '',
  creditoAplicado: '',
  status: 'rascunho',
  motivoCancelamento: '',
  itens: [] as ItemPedido[],
}

export type FormPedidoCompra = typeof formVazio

const TIPOS_COMPRA_VALIDOS = new Set(TIPOS_COMPRA.map((t) => t.value))

export function validarCamposObrigatoriosLancamento(
  form: Pick<FormPedidoCompra, 'tipoCompra' | 'dataFaturamento' | 'previsaoEntrega'>
): string | null {
  if (!form.tipoCompra?.trim() || !TIPOS_COMPRA_VALIDOS.has(form.tipoCompra)) {
    return 'Selecione o tipo de compra.'
  }
  if (!form.dataFaturamento?.trim()) {
    return 'Informe a data de faturamento.'
  }
  if (!form.previsaoEntrega?.trim()) {
    return 'Informe a previsão de entrega.'
  }
  if (form.previsaoEntrega < form.dataFaturamento) {
    return 'Previsão de entrega não pode ser anterior à data de faturamento.'
  }
  return null
}

export function produtoJaExisteNosItens(
  itens: { produtoId: string }[],
  produtoId: string,
  indiceIgnorado?: number | null
): boolean {
  if (!produtoId) return false
  return itens.some(
    (item, indice) =>
      item.produtoId === produtoId && (indiceIgnorado == null || indice !== indiceIgnorado)
  )
}

/** Substitui o lançamento anterior do mesmo produto pelos novos dados (sem duplicar linha). */
export function substituirItemProdutoNosItens<T extends { produtoId: string }>(
  itens: T[],
  item: T,
  indiceEdicao?: number | null
): T[] {
  const alvo =
    indiceEdicao != null ? indiceEdicao : itens.findIndex((it) => it.produtoId === item.produtoId)

  if (alvo < 0) {
    return [...itens, item]
  }

  return itens
    .map((it, i) => (i === alvo ? item : it))
    .filter((it, i) => it.produtoId !== item.produtoId || i === alvo)
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
  return prazos.map((pr) => {
    const vencimento = formatarDataIso(pr.vencimento)
    return {
      numero: pr.numero,
      vencimento,
      valor: pr.valor != null ? String(pr.valor) : '',
      dias: pr.dias ?? calcularDiasEntreDatas(dataFaturamento, vencimento),
    }
  })
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

export const STATUS_COM_AVALIACAO_PEDIDO = [
  'enviado',
  'aprovado',
  'parcial',
  'recebido',
] as const

export function pedidoExibeAbaAvaliacao(status: string): boolean {
  return (STATUS_COM_AVALIACAO_PEDIDO as readonly string[]).includes(status)
}

export function pedidoEditavel(status: string) {
  return !['cancelado', 'recebido', 'aprovado'].includes(status)
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

export function aplicarModalidadeTransportePadraoNoForm(modalidadePadrao: string | null | undefined): {
  modalidadeTransporte?: string
  transportadoraPessoaId?: string
  valorFrete?: string
  valorFreteSugerido?: string
} {
  const modalidade = normalizarModalidadeTransporte(modalidadePadrao)
  if (!modalidade) return {}
  if (!exigeDadosTransporte(modalidade)) {
    return {
      modalidadeTransporte: modalidade,
      transportadoraPessoaId: '',
      valorFrete: '',
      valorFreteSugerido: '0',
    }
  }
  return { modalidadeTransporte: modalidade }
}
