export function rotuloStatusUi(status: string): string {
  switch (status) {
    case 'rascunho':
      return 'Rascunho'
    case 'enviado':
      return 'Enviado'
    case 'aprovado':
      return 'Aprovado'
    case 'parcial':
      return 'Entregue parcialmente'
    case 'recebido':
      return 'Concluído'
    case 'cancelado':
      return 'Cancelado'
    default:
      return status
  }
}

export function varianteStatusUi(
  status: string
): 'ativo' | 'inativo' | 'info' | 'pendente' | 'reprovado' | 'aguardando' {
  switch (status) {
    case 'rascunho':
      return 'inativo'
    case 'enviado':
      return 'aguardando'
    case 'aprovado':
      return 'ativo'
    case 'parcial':
      return 'pendente'
    case 'recebido':
      return 'ativo'
    case 'cancelado':
      return 'reprovado'
    default:
      return 'info'
  }
}

export function formatarPedido(numero: number, descricao?: string | null): string {
  const base = `#${numero}`
  const texto = descricao?.trim()
  return texto ? `${base} — ${texto}` : base
}

export function tituloModalPedido(
  numero: number | undefined,
  descricao?: string | null,
  novo = false
): string {
  if (novo || numero == null) return 'Novo pedido de compra'
  return formatarPedido(numero, descricao)
}

export function podeConcluirPedido(status: string): boolean {
  return status === 'rascunho'
}
