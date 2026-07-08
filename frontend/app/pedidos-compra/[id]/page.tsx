'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { FormularioPedidoCompra } from '@/components/pedidos-compra/formulario-pedido-compra'
import type { ModoPedidoCompra } from '@/lib/pedido-compra-shared'

function ConteudoPedidoCompra({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const [mensagem, setMensagem] = useState('')

  const modoParam = searchParams.get('modo')
  const modo: ModoPedidoCompra = modoParam === 'editar' ? 'editar' : 'visualizar'

  useEffect(() => {
    const msg = searchParams.get('mensagem')
    if (msg) {
      setMensagem(decodeURIComponent(msg))
    }
  }, [searchParams])

  return (
    <div className="space-y-4">
      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagem}</p>
      )}
      <FormularioPedidoCompra modo={modo} pedidoId={id} />
    </div>
  )
}

export default function PaginaPedidoCompraDetalhe({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [id, setId] = useState('')

  useEffect(() => {
    void params.then((p) => setId(p.id))
  }, [params])

  if (!id) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  return (
    <ProtegerRota chaveDaPagina="pedidos-compra">
      <ConteudoPedidoCompra id={id} />
    </ProtegerRota>
  )
}
