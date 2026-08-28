/**
 * Tipos de pendência operacional (estado vivo — sem tabela Notificacao).
 * Fonte: DOCUMENTACAO-SISTEMA.md §6 Pendências.
 */

export const TIPOS_PENDENCIA = [
  'conta_pagar_vencida',
  'conta_pagar_a_vencer',
  'conta_receber_vencida',
  'conta_receber_a_vencer',
  'credito_fornecedor',
  'pendencia_fornecedor',
  'pedido_anexo',
  'pedido_aprovar',
  'cliente_aprovacao',
  'cliente_assinatura',
  'contagem_sessao',
  'contagem_baixar',
  'divergencia_bloquear',
  'estoque_bloqueado',
  'recorrencia_aguardando',
  'problema_entrada',
  'fila_entrada_analise',
  'fila_entrada_chegada',
  'fila_entrada_problemas',
  'fila_entrada_bloqueio',
] as const

export type TipoPendencia = (typeof TIPOS_PENDENCIA)[number]

export type UrgenciaPendencia = 'vencido' | 'hoje' | 'semana' | 'fila'

export type ItemPendencia = {
  id: string
  tipo: TipoPendencia
  urgencia: UrgenciaPendencia
  titulo: string
  descricao: string
  href: string
}

export type ResumoPendencias = {
  total: number
  porTipo: Partial<Record<TipoPendencia, number>>
}

export type ListaPendencias = {
  itens: ItemPendencia[]
  total: number
  pagina: number
  limite: number
}

export const ORDEM_URGENCIA: Record<UrgenciaPendencia, number> = {
  vencido: 0,
  hoje: 1,
  semana: 2,
  fila: 3,
}

export const ROTULO_TIPO_PENDENCIA: Record<TipoPendencia, string> = {
  conta_pagar_vencida: 'Contas a pagar vencidas',
  conta_pagar_a_vencer: 'Contas a pagar a vencer',
  conta_receber_vencida: 'Contas a receber vencidas',
  conta_receber_a_vencer: 'Contas a receber a vencer',
  credito_fornecedor: 'Crédito de fornecedor',
  pendencia_fornecedor: 'Pendência de fornecedor',
  pedido_anexo: 'Documento do pedido',
  pedido_aprovar: 'Pedido para aprovar',
  cliente_aprovacao: 'Cliente aguardando aprovação',
  cliente_assinatura: 'Cliente aguardando assinatura',
  contagem_sessao: 'Contagem em andamento',
  contagem_baixar: 'Contagem para baixar',
  divergencia_bloquear: 'Divergência para bloquear',
  estoque_bloqueado: 'Estoque bloqueado',
  recorrencia_aguardando: 'Recorrência aguardando nota',
  problema_entrada: 'Nota com problema',
  fila_entrada_analise: 'Em análise',
  fila_entrada_chegada: 'Aguardando chegada',
  fila_entrada_problemas: 'Com problemas',
  fila_entrada_bloqueio: 'Entradas com estoque bloqueado',
}

/** Janela padrão: vence em até N dias (hoje inclusivo). */
export const DIAS_A_VENCER = 7
