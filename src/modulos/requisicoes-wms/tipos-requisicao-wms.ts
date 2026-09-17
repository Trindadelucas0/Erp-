export const TIPOS_OPERACAO_REQUISICAO = [
  'separacao',
  'reposicao',
  'conferencia',
  'movimentacao',
  'limpeza',
  'inventario',
] as const

export type TipoOperacaoRequisicao = (typeof TIPOS_OPERACAO_REQUISICAO)[number]

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

export const STATUS_FINAIS: readonly StatusRequisicao[] = ['concluida', 'cancelada']

export const STATUS_CANCELAVEIS: readonly StatusRequisicao[] = [
  'pendente',
  'disponivel',
  'atribuida',
  'em_execucao',
  'pausada',
]

export const STATUS_BLOQUEAVEIS: readonly StatusRequisicao[] = [
  'pendente',
  'disponivel',
  'atribuida',
]

export const STATUS_FILA_OPERADOR_EXCLUIDOS: readonly StatusRequisicao[] = [
  'concluida',
  'cancelada',
  'bloqueada',
]
