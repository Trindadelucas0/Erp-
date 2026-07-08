'use client'

import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { FormularioPedidoCompra } from '@/components/pedidos-compra/formulario-pedido-compra'

export default function PaginaNovoPedidoCompra() {
  return (
    <ProtegerRota chaveDaPagina="pedidos-compra">
      <FormularioPedidoCompra modo="novo" />
    </ProtegerRota>
  )
}
