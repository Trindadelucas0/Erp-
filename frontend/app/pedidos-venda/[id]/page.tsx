'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { formatarMoeda } from '@/lib/pedido-compra-shared'
import { rotuloCondicaoPagamento } from '@/lib/receber-pagamento-orcamento'
import { clienteHttp } from '@/services/api'

type Pedido = {
  numero: string
  data: string
  clienteNome: string
  condicaoPagamento: string
  parametroBoletoNome?: string | null
  prazosBoleto?: number[]
  parcelasCredito?: number | null
  parcelasPagamento?: Array<{ numero: number; dias: number; valor: number; vencimento: string }> | null
  total: number
  totalSt: number
  orcamento: { numero: string }
  itens: Array<{ id: string; codigo: string; descricao: string; marca: string; quantidade: number; unidade: string; precoUnitario: number; percentualDesconto: number; valorSt: number; total: number }>
}

function Conteudo({ id }: { id: string }) {
  const router = useRouter()
  const [pedido, setPedido] = useState<Pedido | null>(null)
  useEffect(() => { void clienteHttp.get<{ pedido: Pedido }>(`/pedidos-venda/${id}`).then((r) => setPedido(r.data.pedido)) }, [id])
  if (!pedido) return <p className="text-sm text-muted-foreground">Carregando pedido…</p>
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => router.push('/pedidos-venda')}><ArrowLeft className="size-4"/>Voltar</Button>
      <TituloPagina caminho="Vendas > Pedidos de venda" subtitulo={`Origem: orçamento ${pedido.orcamento.numero}`}>Pedido de venda {pedido.numero}</TituloPagina>
      <CardPadrao compacto titulo="Dados do pedido"><div className="grid gap-3 sm:grid-cols-3"><div><span className="text-xs text-muted-foreground">Cliente</span><p>{pedido.clienteNome}</p></div><div><span className="text-xs text-muted-foreground">Data</span><p>{pedido.data.split('-').reverse().join('/')}</p></div><div><span className="text-xs text-muted-foreground">Condição</span><p>{rotuloCondicaoPagamento(pedido.condicaoPagamento)}{pedido.parcelasCredito ? ` · ${pedido.parcelasCredito}x` : ''}</p>{pedido.parametroBoletoNome ? <p className="text-sm">{pedido.parametroBoletoNome} · {pedido.prazosBoleto?.join('/')} dias</p> : null}</div></div></CardPadrao>
      {pedido.parcelasPagamento?.length ? <CardPadrao compacto titulo="Parcelas do boleto"><ul className="space-y-2">{pedido.parcelasPagamento.map((p) => <li key={p.numero} className="flex flex-wrap justify-between gap-2 text-sm"><span>Parcela {p.numero} · Vencimento {p.vencimento.split('-').reverse().join('/')}</span><strong>{formatarMoeda(p.valor)}</strong></li>)}</ul></CardPadrao> : null}
      <CardPadrao compacto titulo="Itens">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Produto</th><th className="p-2">Qtd.</th><th className="p-2">Un.</th><th className="p-2 text-right">Preço</th><th className="p-2 text-right">Desc.</th><th className="p-2 text-right">ST</th><th className="p-2 text-right">Total</th></tr></thead><tbody>{pedido.itens.map((item) => <tr key={item.id} className="border-b"><td className="p-2"><strong>{item.descricao}</strong><br/><span className="text-xs text-muted-foreground">{item.codigo}{item.marca ? ` · ${item.marca}` : ''}</span></td><td className="p-2">{item.quantidade}</td><td className="p-2">{item.unidade}</td><td className="p-2 text-right">{formatarMoeda(item.precoUnitario)}</td><td className="p-2 text-right">{item.percentualDesconto}%</td><td className="p-2 text-right">{formatarMoeda(item.valorSt)}</td><td className="p-2 text-right font-medium">{formatarMoeda(item.total)}</td></tr>)}</tbody></table></div>
        <div className="mt-4 flex justify-end gap-6 border-t pt-3"><span>Total de ST: {formatarMoeda(pedido.totalSt)}</span><strong>Total: {formatarMoeda(pedido.total)}</strong></div>
      </CardPadrao>
    </div>
  )
}

export default function PaginaPedidoVenda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ProtegerRota chaveDaPagina="pedidos-venda"><Conteudo id={id}/></ProtegerRota>
}
