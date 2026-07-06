export type StatusUiPedidoCompra = 'rascunho' | 'feito' | 'cancelado'

const STATUS_FEITO = ['enviado', 'parcial', 'recebido'] as const

export function statusParaExibicao(status: string): StatusUiPedidoCompra {
  if (status === 'cancelado') return 'cancelado'
  if (status === 'rascunho') return 'rascunho'
  if (STATUS_FEITO.includes(status as (typeof STATUS_FEITO)[number])) return 'feito'
  return 'rascunho'
}

export function rotuloStatusUi(status: string): string {
  switch (statusParaExibicao(status)) {
    case 'rascunho':
      return 'Rascunho'
    case 'feito':
      return 'Feito'
    case 'cancelado':
      return 'Cancelado'
    default:
      return status
  }
}

export function varianteStatusUi(
  status: string
): 'ativo' | 'inativo' | 'info' | 'pendente' | 'reprovado' | 'aguardando' {
  switch (statusParaExibicao(status)) {
    case 'rascunho':
      return 'inativo'
    case 'feito':
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
  return `Pedido ${formatarPedido(numero, descricao)}`
}

export function podeConcluirPedido(status: string): boolean {
  return status === 'rascunho'
}
