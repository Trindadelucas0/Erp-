/**
 * Regras de negócio compartilhadas para clientes.
 */

export const STATUS_APROVACAO = {
  PENDENTE: 'pendente_aprovacao',
  REPROVADO: 'reprovado',
  AGUARDANDO_ASSINATURA: 'aguardando_assinatura',
  ATIVO: 'ativo',
} as const

export type StatusAprovacao =
  (typeof STATUS_APROVACAO)[keyof typeof STATUS_APROVACAO]

export function clientePodeVender(statusAprovacao: string): boolean {
  return statusAprovacao === STATUS_APROVACAO.ATIVO
}

export function statusPermiteEdicaoVendedor(statusAprovacao: string): boolean {
  return (
    statusAprovacao === STATUS_APROVACAO.PENDENTE ||
    statusAprovacao === STATUS_APROVACAO.REPROVADO
  )
}
