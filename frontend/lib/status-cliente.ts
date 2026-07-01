export const STATUS_APROVACAO = {
  pendente_aprovacao: 'Pendente de aprovação',
  reprovado: 'Reprovado',
  aguardando_assinatura: 'Aguardando assinatura',
  ativo: 'Ativo',
} as const

export type StatusAprovacaoCliente = keyof typeof STATUS_APROVACAO

export const ROTULO_CURTO_APROVACAO = {
  pendente_aprovacao: 'Pendente',
  reprovado: 'Reprovado',
  aguardando_assinatura: 'Assinatura',
  ativo: 'Ativo',
} as const

export function rotuloStatusAprovacao(status?: string | null): string {
  if (!status) return STATUS_APROVACAO.ativo
  return STATUS_APROVACAO[status as StatusAprovacaoCliente] ?? status
}

export function rotuloCurtoStatusAprovacao(status?: string | null): string {
  if (!status) return ROTULO_CURTO_APROVACAO.ativo
  return ROTULO_CURTO_APROVACAO[status as StatusAprovacaoCliente] ?? status
}

export function titleStatusAprovacao(
  status?: string | null,
  motivoReprovacao?: string | null
): string {
  const completo = rotuloStatusAprovacao(status)
  if (status === 'reprovado' && motivoReprovacao) {
    return `${completo}: ${motivoReprovacao}`
  }
  return completo
}

export function varianteBadgeAprovacao(
  status?: string | null
): 'pendente' | 'reprovado' | 'aguardando' | 'ativo' {
  switch (status) {
    case 'pendente_aprovacao':
      return 'pendente'
    case 'reprovado':
      return 'reprovado'
    case 'aguardando_assinatura':
      return 'aguardando'
    default:
      return 'ativo'
  }
}

export const TIPOS_DE_CLIENTE = [
  { value: 'revenda', label: 'Revenda' },
  { value: 'construtora', label: 'Construtora' },
  { value: 'contribuinte_icms', label: 'Contribuinte do ICMS' },
  { value: 'nao_contribuinte_icms', label: 'Não contribuinte do ICMS' },
  { value: 'substituido_substituto', label: 'Substituído / Substituto' },
] as const

export function rotuloTipoCliente(tipo?: string | null): string {
  return TIPOS_DE_CLIENTE.find((t) => t.value === tipo)?.label ?? '—'
}
