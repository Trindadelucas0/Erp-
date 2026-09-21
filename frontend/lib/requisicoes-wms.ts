import { extrairSerieNumeroChave } from '@/lib/chave-acesso-nfe'

export const TIPOS_OPERACAO_REQUISICAO = [
  'separacao',
  'reposicao',
  'conferencia',
  'movimentacao',
  'limpeza',
  'inventario',
  'contagem_entrada',
  'armazenagem',
] as const

export type TipoOperacaoRequisicao = (typeof TIPOS_OPERACAO_REQUISICAO)[number]

export const ROTULO_TIPO_OPERACAO: Record<TipoOperacaoRequisicao, string> = {
  separacao: 'Separação',
  reposicao: 'Reposição',
  conferencia: 'Conferência',
  movimentacao: 'Movimentação',
  limpeza: 'Limpeza',
  inventario: 'Inventário',
  contagem_entrada: 'Contagem de entrada',
  armazenagem: 'Guardar mercadorias',
}

export const OPCOES_TIPO_OPERACAO = TIPOS_OPERACAO_REQUISICAO.filter(
  (value) => value !== 'contagem_entrada' && value !== 'armazenagem'
).map((value) => ({
  value,
  label: ROTULO_TIPO_OPERACAO[value],
}))

export const ROTULO_PRIORIDADE: Record<number, string> = {
  1: '1 — Crítica',
  2: '2 — Alta',
  3: '3 — Normal',
  4: '4 — Baixa',
}

export const OPCOES_PRIORIDADE = [1, 2, 3, 4].map((n) => ({
  value: String(n),
  label: ROTULO_PRIORIDADE[n]!,
}))

export const STATUS_REQUISICAO = [
  'pendente',
  'disponivel',
  'atribuida',
  'em_execucao',
  'pausada',
  'concluida',
  'cancelada',
  'bloqueada',
] as const

export type StatusRequisicao = (typeof STATUS_REQUISICAO)[number]

export const ROTULO_STATUS: Record<StatusRequisicao, string> = {
  pendente: 'Pendente',
  disponivel: 'Disponível',
  atribuida: 'Atribuída',
  em_execucao: 'Em execução',
  pausada: 'Pausada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  bloqueada: 'Bloqueada',
}

export const OPCOES_STATUS = STATUS_REQUISICAO.map((value) => ({
  value,
  label: ROTULO_STATUS[value],
}))

export type EventoRequisicao = {
  id: string
  acao: string
  deStatus: string | null
  paraStatus: string
  motivo: string | null
  usuarioId: string
  usuarioNome: string
  createdAt: string
}

export type RequisicaoWms = {
  id: string
  numero: number
  tipoOperacao: TipoOperacaoRequisicao
  prioridade: number
  status: StatusRequisicao
  origemEnderecoId: string | null
  origemCodigo: string | null
  destinoEnderecoId: string | null
  destinoCodigo: string | null
  produtoId: string | null
  produtoNome: string | null
  produtoSku: string | null
  produtoCodigoBarras: string | null
  produtoBarrasMaster: string[]
  quantidade: number | null
  responsavelId: string | null
  responsavelNome: string | null
  observacao: string | null
  nfeRecebidaId: string | null
  nfeRecebidaChave: string | null
  iniciadoEm: string | null
  pausadoEm: string | null
  concluidoEm: string | null
  qtdExecutada: number | null
  conferidoOrigemEm: string | null
  conferidoProdutoEm: string | null
  conferidoDestinoEm: string | null
  conferidoOrigemValor: string | null
  conferidoProdutoValor: string | null
  conferidoDestinoValor: string | null
  passosExigidos: Array<'origem' | 'produto' | 'quantidade' | 'destino'>
  conferenciaOk: boolean
  controlaEstoque: boolean | null
  produtoUnidade: string | null
  qtdDisponivel: number | null
  createdAt: string
  updatedAt: string
  eventos?: EventoRequisicao[]
}

export type ListaRequisicoes = {
  itens: RequisicaoWms[]
  total: number
  resumoPorStatus: Record<string, number>
}

export function formatarNumeroRequisicao(numero: number) {
  return `REQ-${String(numero).padStart(5, '0')}`
}

export function rotuloNfDaRequisicao(chave: string | null | undefined) {
  if (!chave) return null
  const { serie, numero } = extrairSerieNumeroChave(chave)
  if (!numero) return null
  return serie ? `NF ${numero} série ${serie}` : `NF ${numero}`
}

export function origemDestino(item: RequisicaoWms) {
  const o = item.origemCodigo || '—'
  const d = item.destinoCodigo || '—'
  if (o === '—' && d === '—') return '—'
  return `${o} → ${d}`
}

export type EtapaConferencia = 'origem' | 'produto' | 'quantidade' | 'destino'

export const ROTULO_ETAPA_CONFERENCIA: Record<EtapaConferencia, string> = {
  origem: 'Origem',
  produto: 'Produto',
  quantidade: 'Quantidade',
  destino: 'Destino',
}

export function etapaJaConferida(item: RequisicaoWms, etapa: EtapaConferencia) {
  if (etapa === 'origem') return Boolean(item.conferidoOrigemEm)
  if (etapa === 'produto') return Boolean(item.conferidoProdutoEm)
  if (etapa === 'destino') return Boolean(item.conferidoDestinoEm)
  return item.qtdExecutada != null
}

export function esperadoDaEtapa(item: RequisicaoWms, etapa: EtapaConferencia) {
  if (etapa === 'origem') return item.origemCodigo ?? ''
  if (etapa === 'destino') return item.destinoCodigo ?? ''
  if (etapa === 'produto') {
    if (item.tipoOperacao === 'armazenagem') {
      return barrasArmazenagemTexto(item)
    }
    return item.produtoSku ?? item.produtoNome ?? ''
  }
  return item.quantidade != null ? String(item.quantidade) : ''
}

export function barrasArmazenagemTexto(item: Pick<RequisicaoWms, 'produtoCodigoBarras' | 'produtoBarrasMaster'>) {
  const partes = [
    item.produtoCodigoBarras?.trim(),
    ...(item.produtoBarrasMaster ?? []).map((c) => c.trim()).filter(Boolean),
  ].filter((c): c is string => Boolean(c))
  return [...new Set(partes)].join(' / ')
}

export function produtoTemBarrasArmazenagemUi(
  item: Pick<RequisicaoWms, 'produtoCodigoBarras' | 'produtoBarrasMaster'>
) {
  return Boolean(barrasArmazenagemTexto(item))
}

export type StatusUiArmazenagem =
  | 'pendente'
  | 'em_execucao'
  | 'ok'
  | 'sem_endereco'
  | 'sem_barras'

export function statusUiArmazenagem(item: RequisicaoWms): {
  chave: StatusUiArmazenagem
  rotulo: string
} {
  if (item.status === 'concluida') return { chave: 'ok', rotulo: 'OK/Armazenada' }
  if (!item.destinoEnderecoId) return { chave: 'sem_endereco', rotulo: 'Sem endereço' }
  if (!produtoTemBarrasArmazenagemUi(item)) return { chave: 'sem_barras', rotulo: 'Sem barras' }
  if (item.status === 'em_execucao' || item.status === 'pausada') {
    return { chave: 'em_execucao', rotulo: 'Em execução' }
  }
  return { chave: 'pendente', rotulo: 'Pendente' }
}

export function podeIniciarGuardar(item: RequisicaoWms) {
  if (item.status === 'concluida' || item.status === 'cancelada' || item.status === 'bloqueada') {
    return false
  }
  if (!item.destinoEnderecoId || !produtoTemBarrasArmazenagemUi(item)) return false
  return (
    item.status === 'disponivel' ||
    item.status === 'atribuida' ||
    item.status === 'em_execucao' ||
    item.status === 'pausada'
  )
}

export function podeConcluirExecucao(item: RequisicaoWms, usuarioId: string) {
  return item.status === 'em_execucao' && item.responsavelId === usuarioId && item.conferenciaOk
}
