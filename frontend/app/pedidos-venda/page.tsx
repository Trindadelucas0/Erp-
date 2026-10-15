'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { CampoBuscaLista } from '@/components/compartilhado/campo-busca-lista'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { formatarMoeda } from '@/lib/pedido-compra-shared'
import { textosContemTodosTermos } from '@/lib/normalizar-busca'
import { clienteHttp } from '@/services/api'

type Pedido = {
  id: string
  numero: string
  data: string
  clienteNome: string
  orcamentoNumero: string
  total: number
  quantidadeItens: number
}

function Conteudo() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [busca, setBusca] = useState('')
  useEffect(() => {
    void clienteHttp.get<{ pedidos: Pedido[] }>('/pedidos-venda').then((r) => setPedidos(r.data.pedidos))
  }, [])
  const lista = useMemo(
    () => pedidos.filter((p) => textosContemTodosTermos([p.numero, p.clienteNome, p.orcamentoNumero], busca)),
    [busca, pedidos]
  )
  return (
    <div className="space-y-4">
      <TituloPagina caminho="Vendas > Pedidos de venda" subtitulo="Pedidos gerados pela conversão dos orçamentos.">Pedidos de venda</TituloPagina>
      <CardPadrao compacto>
        <CampoBuscaLista nomeCampo="buscar-pedidos-venda" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Número, cliente ou orçamento" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Número</th><th className="p-2">Data</th><th className="p-2">Cliente</th><th className="p-2">Orçamento</th><th className="p-2">Itens</th><th className="p-2 text-right">Total</th></tr></thead>
            <tbody>{lista.map((p) => <tr key={p.id} className="cursor-pointer border-b hover:bg-muted" onClick={() => router.push(`/pedidos-venda/${p.id}`)}><td className="p-2 font-medium">{p.numero}</td><td className="p-2">{p.data.split('-').reverse().join('/')}</td><td className="p-2">{p.clienteNome}</td><td className="p-2">{p.orcamentoNumero}</td><td className="p-2">{p.quantidadeItens}</td><td className="p-2 text-right">{formatarMoeda(p.total)}</td></tr>)}</tbody>
          </table>
        </div>
      </CardPadrao>
    </div>
  )
}

export default function PaginaPedidosVenda() {
  return <ProtegerRota chaveDaPagina="pedidos-venda"><Conteudo /></ProtegerRota>
}
