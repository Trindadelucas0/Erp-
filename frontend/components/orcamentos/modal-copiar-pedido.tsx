'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { textosContemTodosTermos } from '@/lib/normalizar-busca'
import { formatarMoeda } from '@/lib/pedido-compra-shared'
import { clienteHttp } from '@/services/api'

type Pedido = {
  id: string
  numero: string
  clienteNome: string
  total: number
  quantidadeItens: number
}

export function ModalCopiarPedido({
  aberto,
  aoFechar,
  aoCopiar,
}: {
  aberto: boolean
  aoFechar: () => void
  aoCopiar: (id: string) => Promise<void>
}) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState('')

  useEffect(() => {
    if (aberto) void clienteHttp.get<{ pedidos: Pedido[] }>('/pedidos-venda').then((r) => setPedidos(r.data.pedidos))
  }, [aberto])
  const filtrados = useMemo(
    () => pedidos.filter((p) => textosContemTodosTermos([p.numero, p.clienteNome], busca)),
    [busca, pedidos]
  )
  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl space-y-4 rounded-lg border bg-card p-5 shadow-xl" role="dialog" aria-modal>
        <h2 className="text-lg font-semibold">Copiar pedido</h2>
        <InputPadrao rotulo="Buscar pedido" name="buscar-pedido-venda" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="max-h-80 overflow-auto rounded-md border">
          {filtrados.map((pedido) => (
            <button
              key={pedido.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 border-b px-3 py-3 text-left hover:bg-muted"
              disabled={Boolean(ocupado)}
              onClick={async () => {
                setOcupado(pedido.id)
                try { await aoCopiar(pedido.id); aoFechar() } finally { setOcupado('') }
              }}
            >
              <span><strong>{pedido.numero}</strong><br/><span className="text-xs text-muted-foreground">{pedido.clienteNome} · {pedido.quantidadeItens} itens</span></span>
              <span className="tabular-nums">{formatarMoeda(pedido.total)}</span>
            </button>
          ))}
          {filtrados.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhum pedido encontrado.</p> : null}
        </div>
        <div className="flex justify-end"><Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button></div>
      </div>
    </div>
  )
}
