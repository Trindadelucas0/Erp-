'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Copy, Pencil, Plus } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { BadgeStatus } from '@/components/ui/badge-status'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  formatarPedido,
  rotuloStatusUi,
  varianteStatusUi,
} from '@/lib/status-pedido-compra'
import {
  FILTRO_STATUS_OPCOES,
  FILTROS_VAZIOS,
  formatarData,
  formatarMoeda,
  pedidoEditavel,
  type FiltroStatus,
  type PedidoCompra,
  type PessoaOpcao,
} from '@/lib/pedido-compra-shared'

function ConteudoDaPagina() {
  const roteador = useRouter()
  const searchParams = useSearchParams()
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('compras:create')
  const podeEditar = usePermissao('compras:edit')
  const podeCancelar = usePermissao('compras:delete')

  const [lista, setLista] = useState<PedidoCompra[]>([])
  const [fornecedores, setFornecedores] = useState<PessoaOpcao[]>([])
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false)
  const [idPedidoCancelando, setIdPedidoCancelando] = useState('')
  const [textoMotivoCancelamento, setTextoMotivoCancelamento] = useState('')
  const [erroMotivoCancelamento, setErroMotivoCancelamento] = useState('')
  const [cancelandoPedido, setCancelandoPedido] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS)

  const filtrosAtivos =
    filtros.status !== 'todos' ||
    filtros.fornecedorId !== '' ||
    filtros.buscaNumero.trim() !== '' ||
    filtros.dataInicio !== '' ||
    filtros.dataFim !== ''

  useEffect(() => {
    const msg = searchParams.get('mensagem')
    if (msg) {
      setMensagem(decodeURIComponent(msg))
      roteador.replace('/pedidos-compra', { scroll: false })
    }
  }, [searchParams, roteador])

  const carregar = useCallback(async (filtrosAtuais = filtros) => {
    try {
      const params = new URLSearchParams()
      if (filtrosAtuais.fornecedorId) {
        params.set('fornecedorId', filtrosAtuais.fornecedorId)
      }
      if (filtrosAtuais.status === 'aberto') {
        params.set('statusAberto', 'true')
      } else if (filtrosAtuais.status !== 'todos') {
        params.set('status', filtrosAtuais.status)
      }
      const busca = filtrosAtuais.buscaNumero.trim()
      if (busca) {
        params.set('busca', busca)
      }
      if (filtrosAtuais.dataInicio) {
        params.set('dataInicio', filtrosAtuais.dataInicio)
      }
      if (filtrosAtuais.dataFim) {
        params.set('dataFim', filtrosAtuais.dataFim)
      }
      const qs = params.toString()
      const { data } = await clienteHttp.get(`/pedidos-compra${qs ? `?${qs}` : ''}`)
      setLista(data.pedidos ?? [])
    } catch {
      setErro('Erro ao carregar pedidos de compra.')
    }
  }, [filtros])

  const carregarFornecedores = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get('/fornecedores')
      setFornecedores(
        (data.fornecedores ?? [])
          .filter((f: { ativo: boolean }) => f.ativo)
          .map((f: { id: string; nome: string }) => ({ id: f.id, nome: f.nome }))
      )
    } catch {
      setErro('Erro ao carregar fornecedores.')
    }
  }, [])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    void carregarFornecedores()
  }, [carregandoSessao, estaAutenticado, carregarFornecedores])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    const timer = setTimeout(() => {
      void carregar(filtros)
    }, filtros.buscaNumero.trim() ? 300 : 0)
    return () => clearTimeout(timer)
  }, [carregandoSessao, estaAutenticado, filtros, carregar])

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS)
  }

  async function duplicarPedido(pedidoId: string) {
    setCopiando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.post(`/pedidos-compra/${pedidoId}/copiar`)
      roteador.push(
        `/pedidos-compra/${data.pedido.id}?modo=editar&mensagem=${encodeURIComponent(
          `${formatarPedido(data.pedido.numero)} criado como cópia.`
        )}`
      )
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao duplicar pedido'))
    } finally {
      setCopiando(false)
    }
  }

  function abrirCancelamentoPedido(pedidoId: string) {
    setIdPedidoCancelando(pedidoId)
    setTextoMotivoCancelamento('')
    setErroMotivoCancelamento('')
    setModalCancelarAberto(true)
  }

  async function confirmarCancelamentoPedido() {
    const motivo = textoMotivoCancelamento.trim()
    if (motivo.length < 3) {
      setErroMotivoCancelamento('Informe o motivo do cancelamento (mínimo 3 caracteres).')
      return
    }

    setCancelandoPedido(true)
    setErroMotivoCancelamento('')
    try {
      await clienteHttp.patch(`/pedidos-compra/${idPedidoCancelando}/cancelar`, { motivo })
      const pedido = lista.find((p) => p.id === idPedidoCancelando)
      setMensagem(`${formatarPedido(pedido?.numero ?? 0)} cancelado.`)
      setModalCancelarAberto(false)
      await carregar(filtros)
    } catch (err: unknown) {
      setErroMotivoCancelamento(extrairMensagemApi(err, 'Erro ao cancelar pedido'))
    } finally {
      setCancelandoPedido(false)
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Compras &gt; Pedidos de Compra</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Pedidos de Compra</h1>
      </div>

      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagem}</p>
      )}
      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      <CardPadrao
        titulo="Pedidos"
        acoes={
          podeCriar && (
            <BotaoPrimario type="button" onClick={() => roteador.push('/pedidos-compra/novo')}>
              <Plus className="mr-1 size-4 inline" />
              Novo pedido
            </BotaoPrimario>
          )
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <input
            className="flex h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-[10rem]"
            placeholder="Nº ou descrição"
            value={filtros.buscaNumero}
            onChange={(e) => setFiltros((f) => ({ ...f, buscaNumero: e.target.value }))}
          />
          <select
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
            value={filtros.status}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, status: e.target.value as FiltroStatus }))
            }
          >
            {FILTRO_STATUS_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-w-[12rem] sm:max-w-xs"
            value={filtros.fornecedorId}
            onChange={(e) => setFiltros((f) => ({ ...f, fornecedorId: e.target.value }))}
          >
            <option value="">Todos os fornecedores</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
            value={filtros.dataInicio}
            onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
            title="Data inicial"
          />
          <input
            type="date"
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
            value={filtros.dataFim}
            onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
            title="Data final"
          />
          {filtrosAtivos && (
            <Button type="button" variant="outline" size="sm" onClick={limparFiltros}>
              Limpar
            </Button>
          )}
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          {lista.length} pedido{lista.length !== 1 ? 's' : ''}
        </p>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nº</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Condição pag.</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {filtrosAtivos ? (
                      <span>
                        Nenhum pedido encontrado com os filtros aplicados.{' '}
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={limparFiltros}
                        >
                          Limpar filtros
                        </button>
                      </span>
                    ) : (
                      'Nenhum pedido encontrado.'
                    )}
                  </td>
                </tr>
              )}
              {lista.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-b border-border hover:bg-muted/30"
                  onClick={() => roteador.push(`/pedidos-compra/${p.id}`)}
                >
                  <td className="px-4 py-2 font-medium">{formatarPedido(p.numero)}</td>
                  <td className="px-4 py-2">{formatarData(p.createdAt)}</td>
                  <td className="px-4 py-2">{p.fornecedorNome}</td>
                  <td className="px-4 py-2">
                    <BadgeStatus
                      variante={varianteStatusUi(p.status)}
                      title={
                        p.status === 'cancelado' && p.motivoCancelamento
                          ? p.motivoCancelamento
                          : undefined
                      }
                    >
                      {rotuloStatusUi(p.status)}
                    </BadgeStatus>
                  </td>
                  <td className="px-4 py-2">{formatarMoeda(p.totalLiquido)}</td>
                  <td className="px-4 py-2">{p.condicaoPagamento ?? '—'}</td>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {podeCriar && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title="Duplicar"
                          disabled={copiando}
                          onClick={() => void duplicarPedido(p.id)}
                        >
                          <Copy className="size-4" />
                        </Button>
                      )}
                      {podeEditar && pedidoEditavel(p.status) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title="Editar"
                          onClick={() => roteador.push(`/pedidos-compra/${p.id}?modo=editar`)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {podeCancelar && pedidoEditavel(p.status) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirCancelamentoPedido(p.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      <Modal
        aberto={modalCancelarAberto}
        aoFechar={() => setModalCancelarAberto(false)}
        titulo="Cancelar pedido"
        largura="md"
        rodape={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalCancelarAberto(false)}
              disabled={cancelandoPedido}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmarCancelamentoPedido()}
              disabled={cancelandoPedido}
            >
              {cancelandoPedido ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="motivo-cancelar-pedido">Motivo do cancelamento *</Label>
          <textarea
            id="motivo-cancelar-pedido"
            value={textoMotivoCancelamento}
            onChange={(e) => setTextoMotivoCancelamento(e.target.value)}
            rows={4}
            placeholder="Descreva o motivo do cancelamento"
            className={cn(
              'w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none',
              'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              erroMotivoCancelamento && 'border-destructive'
            )}
          />
          {erroMotivoCancelamento && (
            <p className="text-sm text-destructive">{erroMotivoCancelamento}</p>
          )}
          <p className="text-xs text-muted-foreground">
            O pedido será marcado como cancelado e não poderá mais ser editado.
          </p>
        </div>
      </Modal>
    </div>
  )
}

export default function PaginaPedidosCompra() {
  return (
    <ProtegerRota chaveDaPagina="pedidos-compra">
      <ConteudoDaPagina />
    </ProtegerRota>
  )
}
