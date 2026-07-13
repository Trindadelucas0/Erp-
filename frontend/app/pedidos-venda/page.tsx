'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { BadgeStatus } from '@/components/ui/badge-status'
import { ModalConfirmacao } from '@/components/compartilhado/modal-confirmacao'
import { ComboboxProduto } from '@/components/pedidos-compra/combobox-produto'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  formatarMoeda,
  itemVendaVazio,
  parseNum,
  pedidoVendaEditavel,
  rotuloStatusVenda,
  type ItemPedidoVenda,
  type PedidoVenda,
  type ProdutoVendaOpcao,
} from '@/lib/pedido-venda-shared'
import {
  converterQtdParaUnidadeVenda,
  resolverItensNaCaixa,
  resolverPrecoUnitarioVenda,
  sugerirQuantidadeMultiploVenda,
  validarQuantidadeModoCx,
  validarQuantidadeModoUn,
} from '@/lib/regras-venda-produto'

function ConteudoDaPagina() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('vendas:create')
  const podeEditar = usePermissao('vendas:edit')

  const [lista, setLista] = useState<PedidoVenda[]>([])
  const [produtos, setProdutos] = useState<ProdutoVendaOpcao[]>([])
  const [busca, setBusca] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [clienteNome, setClienteNome] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemPedidoVenda[]>([itemVendaVazio()])
  const [rascunho, setRascunho] = useState<ItemPedidoVenda>(itemVendaVazio())
  const [confirmacaoMultiploAberta, setConfirmacaoMultiploAberta] = useState(false)
  const [quantidadeSugerida, setQuantidadeSugerida] = useState(0)
  const [multiploPendente, setMultiploPendente] = useState(0)

  const carregar = useCallback(async (termo = busca) => {
    try {
      const qs = termo.trim() ? `?busca=${encodeURIComponent(termo.trim())}` : ''
      const { data } = await clienteHttp.get(`/pedidos-venda${qs}`)
      setLista(data.pedidos ?? [])
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao carregar pedidos de venda'))
    }
  }, [busca])

  const carregarProdutos = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get('/produtos')
      setProdutos(
        (data.produtos ?? [])
          .filter((p: { ativo: boolean }) => p.ativo)
          .map(
            (p: {
              id: string
              nomeVenda: string
              sku: string | null
              unidade: string
              multiploVenda?: number
              permiteVendaFracionada?: boolean
              bloqueadoVenda?: boolean
              precoCusto?: number | null
              embalagensMaster?: { quantidade: number }[]
              fornecedores?: { multiplicadorEntrada?: number | null }[]
            }) => ({
              id: p.id,
              nomeVenda: p.nomeVenda,
              sku: p.sku,
              unidade: p.unidade,
              multiploVenda: p.multiploVenda ?? 1,
              permiteVendaFracionada: p.permiteVendaFracionada ?? false,
              bloqueadoVenda: p.bloqueadoVenda ?? false,
              precoCusto: p.precoCusto ?? null,
              embalagensMaster: p.embalagensMaster ?? [],
              fornecedores: (p.fornecedores ?? []).map((f) => ({
                multiplicadorEntrada: f.multiplicadorEntrada ?? null,
              })),
            })
          )
      )
    } catch {
      setProdutos([])
    }
  }, [])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    void carregar()
    void carregarProdutos()
  }, [carregandoSessao, estaAutenticado, carregar, carregarProdutos])

  const totalForm = useMemo(
    () =>
      itens.reduce((s, item) => {
        const produto = produtos.find((p) => p.id === item.produtoId)
        const itensCaixa =
          item.itensPorEmbalagem && item.itensPorEmbalagem > 0
            ? item.itensPorEmbalagem
            : produto
              ? resolverItensNaCaixa(produto)
              : 1
        const qtdUn =
          item.quantidadeUnidadeVenda ??
          converterQtdParaUnidadeVenda(
            item.modoQuantidade,
            parseNum(item.quantidadeInformada),
            itensCaixa
          )
        return s + qtdUn * parseNum(item.precoUnitario)
      }, 0),
    [itens, produtos]
  )

  function abrirNovo() {
    setIdEmEdicao('')
    setClienteNome('')
    setObservacoes('')
    setItens([])
    setRascunho(itemVendaVazio())
    setErro('')
    setModalAberto(true)
  }

  async function abrirEdicao(id: string) {
    try {
      const { data } = await clienteHttp.get(`/pedidos-venda/${id}`)
      const p = data.pedido as PedidoVenda
      setIdEmEdicao(p.id)
      setClienteNome(p.clienteNome)
      setObservacoes(p.observacoes ?? '')
      setItens(
        p.itens.map((i) => ({
          ...i,
          quantidadeInformada: String(i.quantidadeInformada),
          // API já persiste unitário — sem reconversão CX.
          precoUnitario: String(i.precoUnitario),
        }))
      )
      setRascunho(itemVendaVazio())
      setModalAberto(true)
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao abrir pedido'))
    }
  }

  function aoSelecionarProduto(produtoId: string) {
    const produto = produtos.find((p) => p.id === produtoId)
    if (!produto) {
      setRascunho(itemVendaVazio())
      return
    }
    setRascunho({
      ...itemVendaVazio(),
      produtoId,
      produtoNome: produto.nomeVenda,
      produtoSku: produto.sku,
      unidade: produto.unidade,
      precoUnitario: produto.precoCusto != null ? String(produto.precoCusto) : '0',
      modoQuantidade: 'UN',
      quantidadeInformada: '1',
    })
  }

  function tentarAdicionarItem(itemBase: ItemPedidoVenda = rascunho) {
    setErro('')
    if (!itemBase.produtoId) {
      setErro('Selecione o produto.')
      return
    }
    const produto = produtos.find((p) => p.id === itemBase.produtoId)
    if (!produto) {
      setErro('Produto inválido.')
      return
    }
    if (produto.bloqueadoVenda) {
      setErro('Produto bloqueado para venda.')
      return
    }

    const qtd = parseNum(itemBase.quantidadeInformada)
    if (itemBase.modoQuantidade === 'CX') {
      const validacao = validarQuantidadeModoCx(qtd)
      if (!validacao.ok) {
        setErro(validacao.mensagem)
        return
      }
    } else {
      const validacao = validarQuantidadeModoUn(
        qtd,
        produto.permiteVendaFracionada,
        produto.multiploVenda
      )
      if (!validacao.ok) {
        const sugestao = sugerirQuantidadeMultiploVenda(qtd, produto.multiploVenda)
        if (sugestao) {
          setQuantidadeSugerida(sugestao.quantidadeSugerida)
          setMultiploPendente(sugestao.multiplo)
          setConfirmacaoMultiploAberta(true)
          setErro(validacao.mensagem)
          return
        }
        setErro(validacao.mensagem)
        return
      }
    }

    const itensCaixa = resolverItensNaCaixa(produto)
    const precoDigitado = parseNum(itemBase.precoUnitario)
    const precoUnitario = resolverPrecoUnitarioVenda(
      itemBase.modoQuantidade,
      precoDigitado,
      itensCaixa
    )
    const qtdUn = converterQtdParaUnidadeVenda(
      itemBase.modoQuantidade,
      qtd,
      itensCaixa
    )

    setItens((atual) => [
      ...atual,
      {
        ...itemBase,
        itensPorEmbalagem: itensCaixa,
        precoUnitario: String(precoUnitario),
        quantidadeUnidadeVenda: qtdUn,
        total: Math.round(qtdUn * precoUnitario * 100) / 100,
      },
    ])
    setRascunho(itemVendaVazio())
  }

  function montarPayload(concluir: boolean) {
    return {
      clienteNome: clienteNome.trim(),
      observacoes: observacoes.trim() || null,
      sobEncomenda: false,
      concluir,
      itens: itens.map((item, ordem) => ({
        produtoId: item.produtoId,
        modoQuantidade: item.modoQuantidade,
        quantidadeInformada: parseNum(item.quantidadeInformada),
        precoUnitario: parseNum(item.precoUnitario),
        ordem,
      })),
    }
  }

  async function salvar(concluir: boolean) {
    setErro('')
    if (clienteNome.trim().length < 2) {
      setErro('Informe o nome do cliente.')
      return
    }
    if (itens.length === 0) {
      setErro('Adicione ao menos um item.')
      return
    }

    setSalvando(true)
    try {
      const payload = montarPayload(concluir)
      if (idEmEdicao) {
        await clienteHttp.put(`/pedidos-venda/${idEmEdicao}`, payload)
      } else {
        await clienteHttp.post('/pedidos-venda', payload)
      }
      setModalAberto(false)
      setMensagem(concluir ? 'Pedido concluído.' : 'Rascunho salvo.')
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar pedido de venda'))
    } finally {
      setSalvando(false)
    }
  }

  async function cancelarPedido(id: string) {
    try {
      await clienteHttp.patch(`/pedidos-venda/${id}/cancelar`)
      setMensagem('Pedido cancelado.')
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao cancelar'))
    }
  }

  return (
    <div className="space-y-4 p-4">
      {mensagem && <p className="text-sm text-emerald-700">{mensagem}</p>}
      {erro && !modalAberto && <p className="text-sm text-destructive">{erro}</p>}

      <CardPadrao>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <InputPadrao
            rotulo="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Número ou cliente"
            className="max-w-xs"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void carregar()}>
              Filtrar
            </Button>
            {podeCriar && (
              <BotaoPrimario type="button" onClick={abrirNovo}>
                <Plus className="mr-1 size-4" />
                Novo pedido
              </BotaoPrimario>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-2 py-2">Nº</th>
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                    Nenhum pedido de venda.
                  </td>
                </tr>
              ) : (
                lista.map((pedido) => (
                  <tr key={pedido.id} className="border-b">
                    <td className="px-2 py-2">#{pedido.numero}</td>
                    <td className="px-2 py-2">{pedido.clienteNome}</td>
                    <td className="px-2 py-2">
                      <BadgeStatus
                        variante={
                          pedido.status === 'concluido'
                            ? 'ativo'
                            : pedido.status === 'cancelado'
                              ? 'reprovado'
                              : 'pendente'
                        }
                      >
                        {rotuloStatusVenda(pedido.status)}
                      </BadgeStatus>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{formatarMoeda(pedido.totalLiquido)}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        {podeEditar && pedidoVendaEditavel(pedido.status) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void abrirEdicao(pedido.id)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {podeEditar && pedidoVendaEditavel(pedido.status) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void cancelarPedido(pedido.id)}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo={idEmEdicao ? 'Editar pedido de venda' : 'Novo pedido de venda'}
      >
        <div className="max-h-[80vh] space-y-4 overflow-y-auto p-1">
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <InputPadrao
            rotulo="Cliente"
            value={clienteNome}
            onChange={(e) => setClienteNome(e.target.value)}
            placeholder="Nome do cliente"
            obrigatorio
          />
          <InputPadrao
            rotulo="Observações"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />

          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Lançar item</p>
            <ComboboxProduto
              produtos={produtos}
              valor={rascunho.produtoId}
              aoMudar={aoSelecionarProduto}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectPadrao
                rotulo="Modo"
                valor={rascunho.modoQuantidade}
                aoMudar={(v) =>
                  setRascunho((r) => ({ ...r, modoQuantidade: v === 'CX' ? 'CX' : 'UN' }))
                }
                opcoes={[
                  { value: 'UN', label: 'Unidade (UN)' },
                  { value: 'CX', label: 'Caixa (CX)' },
                ]}
              />
              <InputPadrao
                rotulo="Quantidade"
                value={rascunho.quantidadeInformada}
                onChange={(e) =>
                  setRascunho((r) => ({
                    ...r,
                    quantidadeInformada: e.target.value.replace(/[^\d,.]/g, ''),
                  }))
                }
                inputMode="decimal"
              />
              <InputPadrao
                rotulo={
                  rascunho.modoQuantidade === 'CX' ? 'Preço da caixa' : 'Preço unitário'
                }
                value={rascunho.precoUnitario}
                onChange={(e) =>
                  setRascunho((r) => ({
                    ...r,
                    precoUnitario: e.target.value.replace(/[^\d,.]/g, ''),
                  }))
                }
                inputMode="decimal"
              />
            </div>
            {rascunho.produtoId &&
              (() => {
                const produtoSel = produtos.find((p) => p.id === rascunho.produtoId)
                const itensCaixa = resolverItensNaCaixa(
                  produtoSel ?? {
                    unidade: 'UN',
                    embalagensMaster: [],
                    fornecedores: [],
                  }
                )
                const qtdUn = converterQtdParaUnidadeVenda(
                  rascunho.modoQuantidade,
                  parseNum(rascunho.quantidadeInformada),
                  itensCaixa
                )
                const precoUn = resolverPrecoUnitarioVenda(
                  rascunho.modoQuantidade,
                  parseNum(rascunho.precoUnitario),
                  itensCaixa
                )
                return (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Qtd total UN de venda: {qtdUn}</p>
                    {rascunho.modoQuantidade === 'CX' && (
                      <p>
                        Preço unitário calculado: {formatarMoeda(precoUn)}
                        {itensCaixa > 0
                          ? ` (${formatarMoeda(parseNum(rascunho.precoUnitario))} ÷ ${itensCaixa})`
                          : ''}
                      </p>
                    )}
                  </div>
                )
              })()}
            <Button type="button" variant="outline" onClick={() => tentarAdicionarItem()}>
              <Plus className="mr-1 size-4" />
              Adicionar item
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-2 py-1.5">Produto</th>
                  <th className="px-2 py-1.5">Modo</th>
                  <th className="px-2 py-1.5">Qtd</th>
                  <th className="px-2 py-1.5">Qtd UN</th>
                  <th className="px-2 py-1.5">Preço UN</th>
                  <th className="px-2 py-1.5">Total</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                      Nenhum item lançado.
                    </td>
                  </tr>
                ) : (
                  itens.map((item, index) => {
                    const produto = produtos.find((p) => p.id === item.produtoId)
                    const itensCaixa =
                      item.itensPorEmbalagem && item.itensPorEmbalagem > 0
                        ? item.itensPorEmbalagem
                        : produto
                          ? resolverItensNaCaixa(produto)
                          : 1
                    const qtdUn =
                      item.quantidadeUnidadeVenda ??
                      converterQtdParaUnidadeVenda(
                        item.modoQuantidade,
                        parseNum(item.quantidadeInformada),
                        itensCaixa
                      )
                    const precoUn = parseNum(item.precoUnitario)
                    const total =
                      item.total ?? Math.round(qtdUn * precoUn * 100) / 100
                    return (
                      <tr key={`${item.produtoId}-${index}`} className="border-b">
                        <td className="px-2 py-1.5">{item.produtoNome ?? produto?.nomeVenda ?? '—'}</td>
                        <td className="px-2 py-1.5">{item.modoQuantidade}</td>
                        <td className="px-2 py-1.5 tabular-nums">{item.quantidadeInformada}</td>
                        <td className="px-2 py-1.5 tabular-nums">{qtdUn}</td>
                        <td className="px-2 py-1.5 tabular-nums">{formatarMoeda(precoUn)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{formatarMoeda(total)}</td>
                        <td className="px-2 py-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setItens((atual) => atual.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Total: {formatarMoeda(totalForm)}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                Fechar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={salvando}
                onClick={() => void salvar(false)}
              >
                Salvar rascunho
              </Button>
              <BotaoPrimario type="button" disabled={salvando} onClick={() => void salvar(true)}>
                Concluir pedido
              </BotaoPrimario>
            </div>
          </div>
        </div>
      </Modal>

      <ModalConfirmacao
        aberto={confirmacaoMultiploAberta}
        titulo="Múltiplo de venda"
        mensagem={`Quantidade menor que o múltiplo permitido. Múltiplo: ${multiploPendente}.\n\nAdequar quantidade para ${quantidadeSugerida}?`}
        textoConfirmar={`Adequar para ${quantidadeSugerida}`}
        textoCancelar="Cancelar"
        aoConfirmar={() => {
          const ajustado = {
            ...rascunho,
            quantidadeInformada: String(quantidadeSugerida),
          }
          setRascunho(ajustado)
          setConfirmacaoMultiploAberta(false)
          setErro('')
          tentarAdicionarItem(ajustado)
        }}
        aoCancelar={() => {
          setConfirmacaoMultiploAberta(false)
        }}
      />
    </div>
  )
}

export default function PaginaPedidosVenda() {
  return (
    <ProtegerRota chaveDaPagina="pedidos-venda">
      <ConteudoDaPagina />
    </ProtegerRota>
  )
}
