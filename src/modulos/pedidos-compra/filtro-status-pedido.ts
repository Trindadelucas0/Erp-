import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

export const STATUSES_PEDIDO_PERMITIDOS = [
  'rascunho',
  'enviado',
  'parcial',
  'recebido',
  'cancelado',
] as const

export type StatusPedidoPermitido = (typeof STATUSES_PEDIDO_PERMITIDOS)[number]

export function parsearStatusesQuery(
  valor: string | string[] | undefined
): StatusPedidoPermitido[] | undefined {
  if (valor == null) return undefined

  const partes = (Array.isArray(valor) ? valor : [valor])
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean)

  if (partes.length === 0) return undefined

  const invalidos = partes.filter(
    (status) => !STATUSES_PEDIDO_PERMITIDOS.includes(status as StatusPedidoPermitido)
  )
  if (invalidos.length > 0) {
    throw new ErroDaAplicacao(`Status inválido: ${invalidos.join(', ')}`, 400)
  }

  return [...new Set(partes)] as StatusPedidoPermitido[]
}
