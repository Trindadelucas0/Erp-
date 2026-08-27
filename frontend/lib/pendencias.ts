/**
 * Tipos e helpers de Pendências no frontend (espelho do backend).
 */

export type UrgenciaPendencia = 'vencido' | 'hoje' | 'semana' | 'fila'

export type ItemPendencia = {
  id: string
  tipo: string
  urgencia: UrgenciaPendencia
  titulo: string
  descricao: string
  href: string
}

export type ResumoPendencias = {
  total: number
  porTipo: Record<string, number>
}

export type ListaPendencias = {
  itens: ItemPendencia[]
  total: number
  pagina: number
  limite: number
}

export const ROTULO_TIPO_PENDENCIA: Record<string, string> = {
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
  fila_entrada_contagem: 'Liberadas para contagem',
  fila_entrada_problemas: 'Com problemas',
  fila_entrada_bloqueio: 'Entradas com estoque bloqueado',
}

/** Rotas sem dock de pendências. */
export function rotaSemDockPendencias(pathname: string | null): boolean {
  if (!pathname) return true
  if (pathname === '/login' || pathname.startsWith('/login/')) return true
  if (pathname.startsWith('/portal-fornecedor')) return true
  if (pathname.startsWith('/assinatura')) return true
  if (pathname === '/pendencias' || pathname.startsWith('/pendencias/')) return true
  return false
}

export function classeUrgenciaPendencia(urgencia: UrgenciaPendencia): string {
  if (urgencia === 'vencido') return 'border-destructive/40 bg-destructive/5'
  if (urgencia === 'hoje') return 'border-amber-500/40 bg-amber-500/5'
  if (urgencia === 'semana') return 'border-primary/30 bg-primary/5'
  return 'border-border bg-card'
}
