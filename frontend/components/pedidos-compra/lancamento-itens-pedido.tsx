'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { History, Plus, Trash2 } from 'lucide-react'
import { ComboboxProduto } from '@/components/pedidos-compra/combobox-produto'
import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { Checkbox } from '@/components/ui/checkbox'
import { InputPadrao } from '@/components/ui/input-padrao'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'
import { cn } from '@/lib/utils'
import {
  calcularTotalItem,
  itemVazio,
  parseNum,
  produtoJaExisteNosItens,
  type ItemPedido,
  type ProdutoOpcao,
} from '@/lib/pedido-compra-shared'
import { ModalConfirmacao } from '@/components/compartilhado/modal-confirmacao'
import {
  calcularPrecoUnitarioPreview,
  calcularQtdTotalUnVenda,
  obterVinculoFornecedor,
  recalcularCodigoUnidadeItem,
  resolverItensPorEmbalagem,
  rotuloCampoPrecoEntrada,
  rotuloOrigemPreco,
  sugerirQuantidadeMultiplo,
} from '@/lib/preencher-item-pedido-compra'
import { resolverUrlUpload } from '@/lib/resolver-url-upload'

type ColunaOrdenacao =
  | 'produto'
  | 'marca'
  | 'codigoOriginal'
  | 'unidade'
  | 'quantidade'
  | 'itensPorEmbalagem'
  | 'qtdTotalUnVenda'
  | 'preco'
  | 'pctDesconto'
  | 'valorDesconto'
  | 'outras'
  | 'totalBruto'
  | 'totalLiquido'
  | 'previsaoEntrega'

type LinhaExibida = {
  item: ItemPedido
  indiceOriginal: number
}

type Props = {
  fornecedorPessoaId: string
  itens: ItemPedido[]
  produtos: ProdutoOpcao[]
  disabled: boolean
  formatarMoeda: (v: number) => string
  formatarData: (iso: string) => string
  onPreencherProduto: (produtoId: string, base: ItemPedido) => Promise<ItemPedido>
  onAdicionar: (item: ItemPedido) => void
  onAtualizar: (indiceOriginal: number, item: ItemPedido) => void
  onRemoverVarios: (indicesOriginais: number[]) => void
  onSubstituirProduto: (item: ItemPedido, indiceEdicao: number | null) => void
  onAbrirHistorico: (produtoId: string) => void
}

function nomeProduto(item: ItemPedido, produtos: ProdutoOpcao[]): string {
  if (item.produtoNome?.trim()) return item.produtoNome
  const produto = produtos.find((p) => p.id === item.produtoId)
  return produto?.nomeVenda ?? '—'
}

function marcaDoItem(item: ItemPedido, produtos: ProdutoOpcao[]): string {
  if (item.produtoMarca?.trim()) return item.produtoMarca
  const produto = produtos.find((p) => p.id === item.produtoId)
  return produto?.marca?.trim() || '—'
}

function dadosEmbalagemDoItem(
  item: ItemPedido,
  produtos: ProdutoOpcao[],
  fornecedorPessoaId: string
) {
  const produto = produtos.find((p) => p.id === item.produtoId)
  const vinculo = produto ? obterVinculoFornecedor(produto, fornecedorPessoaId) : undefined
  const itensPorEmbalagem = resolverItensPorEmbalagem(produto, fornecedorPessoaId)
  const quantidade = parseNum(item.quantidade)
  return {
    itensPorEmbalagem,
    qtdTotalUnVenda: calcularQtdTotalUnVenda(quantidade, itensPorEmbalagem),
    multiploEntrada: vinculo?.multiploEntrada ?? null,
  }
}

function urlFotoDoItem(item: ItemPedido, produtos: ProdutoOpcao[]): string | null {
  const produto = produtos.find((p) => p.id === item.produtoId)
  return resolverUrlUpload(produto?.urlFotoMiniatura)
}

export function LancamentoItensPedido({
  fornecedorPessoaId,
  itens,
  produtos,
  disabled,
  formatarMoeda,
  formatarData,
  onPreencherProduto,
  onAdicionar,
  onAtualizar,
  onRemoverVarios,
  onSubstituirProduto,
  onAbrirHistorico,
}: Props) {
  const [rascunho, setRascunho] = useState<ItemPedido>(itemVazio())
  const [indiceEdicao, setIndiceEdicao] = useState<number | null>(null)
  const [erroRascunho, setErroRascunho] = useState('')
  const [confirmacaoDuplicadoAberta, setConfirmacaoDuplicadoAberta] = useState(false)
  const [itemDuplicadoPendente, setItemDuplicadoPendente] = useState<ItemPedido | null>(null)
  const [indiceEdicaoDuplicado, setIndiceEdicaoDuplicado] = useState<number | null>(null)
  const [confirmacaoMultiploAberta, setConfirmacaoMultiploAberta] = useState(false)
  const [itemMultiploPendente, setItemMultiploPendente] = useState<ItemPedido | null>(null)
  const [quantidadeSugeridaMultiplo, setQuantidadeSugeridaMultiplo] = useState(0)
  const [multiploPendente, setMultiploPendente] = useState(0)
  const [indicesSelecionados, setIndicesSelecionados] = useState<number[]>([])
  const [confirmacaoExclusaoMassaAberta, setConfirmacaoExclusaoMassaAberta] = useState(false)
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<ColunaOrdenacao>()
  const [preenchendoProduto, setPreenchendoProduto] = useState(false)
  const containerRascunhoRef = useRef<HTMLDivElement>(null)
  const rascunhoRef = useRef(rascunho)
  const preenchendoProdutoRef = useRef(preenchendoProduto)
  const indiceEdicaoRef = useRef(indiceEdicao)
  const onAdicionarRef = useRef(onAdicionar)
  const onAtualizarRef = useRef(onAtualizar)
  const onSubstituirProdutoRef = useRef(onSubstituirProduto)
  rascunhoRef.current = rascunho
  preenchendoProdutoRef.current = preenchendoProduto
  indiceEdicaoRef.current = indiceEdicao
  onAdicionarRef.current = onAdicionar
  onAtualizarRef.current = onAtualizar
  onSubstituirProdutoRef.current = onSubstituirProduto

  useEffect(() => {
    if (disabled) {
      setIndicesSelecionados([])
      setConfirmacaoExclusaoMassaAberta(false)
    }
  }, [disabled])

  useEffect(() => {
    setIndicesSelecionados((atual) => {
      const validos = atual.filter((indice) => indice >= 0 && indice < itens.length)
      return validos.length === atual.length ? atual : validos
    })
  }, [itens.length])
  useEffect(() => {
    setRascunho((atual) => {
      if (!atual.produtoId) return atual
      const produto = produtos.find((p) => p.id === atual.produtoId)
      if (!produto) return atual
      return recalcularCodigoUnidadeItem(atual, produto, fornecedorPessoaId)
    })
  }, [fornecedorPessoaId, produtos])

  const itensLancados = useMemo(
    () =>
      itens
        .map((item, indiceOriginal) => ({ item, indiceOriginal }))
        .filter((linha) => !!linha.item.produtoId),
    [itens]
  )

  const linhasExibidas: LinhaExibida[] = useMemo(
    () =>
      ordenarLista(itensLancados, ordenacao, (linha, coluna) => {
        const item = linha.item
        const totais = calcularTotalItem(item)
        const embalagem = dadosEmbalagemDoItem(item, produtos, fornecedorPessoaId)
        switch (coluna) {
          case 'produto':
            return nomeProduto(item, produtos)
          case 'marca':
            return marcaDoItem(item, produtos)
          case 'codigoOriginal':
            return item.codigoOriginal || ''
          case 'unidade':
            return item.unidade || ''
          case 'itensPorEmbalagem':
            return embalagem.itensPorEmbalagem
          case 'quantidade':
            return parseNum(item.quantidade)
          case 'qtdTotalUnVenda':
            return embalagem.qtdTotalUnVenda
          case 'preco':
            return parseNum(item.precoUnitario)
          case 'pctDesconto':
            return parseNum(item.percentualDesconto)
          case 'valorDesconto':
            return parseNum(item.valorDesconto)
          case 'outras':
            return parseNum(item.outrasDespesas)
          case 'totalBruto':
            return totais.bruto
          case 'totalLiquido':
            return totais.liquido
          case 'previsaoEntrega':
            return item.previsaoEntrega || ''
        }
      }),
    [itensLancados, ordenacao, produtos, fornecedorPessoaId]
  )

  const totaisRascunho = calcularTotalItem(rascunho)
  const origemPrecoLabel = rotuloOrigemPreco(rascunho.origemPreco)
  const produtoRascunho = produtos.find((p) => p.id === rascunho.produtoId)
  const vinculoRascunho = produtoRascunho
    ? obterVinculoFornecedor(produtoRascunho, fornecedorPessoaId)
    : undefined
  const itensPorEmbalagemRascunho = resolverItensPorEmbalagem(
    produtoRascunho,
    fornecedorPessoaId
  )
  const multiploEntradaRascunho = vinculoRascunho?.multiploEntrada ?? null
  const qtdTotalUnRascunho = calcularQtdTotalUnVenda(
    parseNum(rascunho.quantidade),
    itensPorEmbalagemRascunho
  )
  const precoUnitarioPreview = calcularPrecoUnitarioPreview(
    parseNum(rascunho.precoUnitario),
    itensPorEmbalagemRascunho
  )
  const rotuloPrecoRascunho = rotuloCampoPrecoEntrada(itensPorEmbalagemRascunho)
  const editando = indiceEdicao != null

  function limparRascunho() {
    setRascunho(itemVazio())
    setIndiceEdicao(null)
    setErroRascunho('')
  }

  const indicesVisiveis = useMemo(
    () => linhasExibidas.map((linha) => linha.indiceOriginal),
    [linhasExibidas]
  )
  const quantidadeSelecionada = indicesSelecionados.length
  const todosVisiveisMarcados =
    indicesVisiveis.length > 0 && indicesVisiveis.every((indice) => indicesSelecionados.includes(indice))
  const algunsVisiveisMarcados = indicesVisiveis.some((indice) =>
    indicesSelecionados.includes(indice)
  )
  const estadoCheckboxCabecalho: boolean | 'indeterminate' = todosVisiveisMarcados
    ? true
    : algunsVisiveisMarcados
      ? 'indeterminate'
      : false

  function alternarSelecaoLinha(indiceOriginal: number, marcado: boolean) {
    setIndicesSelecionados((atual) => {
      if (marcado) {
        if (atual.includes(indiceOriginal)) return atual
        return [...atual, indiceOriginal]
      }
      return atual.filter((indice) => indice !== indiceOriginal)
    })
  }

  function alternarSelecaoTodosVisiveis(marcar: boolean) {
    setIndicesSelecionados((atual) => {
      if (marcar) {
        const juntos = new Set([...atual, ...indicesVisiveis])
        return [...juntos]
      }
      const remover = new Set(indicesVisiveis)
      return atual.filter((indice) => !remover.has(indice))
    })
  }

  function desmarcarSelecao() {
    setIndicesSelecionados([])
    setConfirmacaoExclusaoMassaAberta(false)
  }

  function confirmarExclusaoMassa() {
    const lote = [...indicesSelecionados]
    if (lote.length === 0) {
      setConfirmacaoExclusaoMassaAberta(false)
      return
    }
    if (indiceEdicao != null) {
      if (lote.includes(indiceEdicao)) {
        limparRascunho()
      } else {
        const removidosAntes = lote.filter((indice) => indice < indiceEdicao).length
        if (removidosAntes > 0) {
          setIndiceEdicao(indiceEdicao - removidosAntes)
        }
      }
    }
    onRemoverVarios(lote)
    setIndicesSelecionados([])
    setConfirmacaoExclusaoMassaAberta(false)
  }

  function aplicarItemConfirmado(atual: ItemPedido, indiceEdicaoAtual: number | null) {
    if (indiceEdicaoAtual != null) {
      onAtualizarRef.current(indiceEdicaoAtual, atual)
    } else {
      onAdicionarRef.current(atual)
    }
    limparRascunho()
  }

  function atualizarRascunho(campo: keyof ItemPedido, valor: string) {
    setRascunho((atual) => {
      const proximo = { ...atual, [campo]: valor }
      if (campo === 'precoUnitario') {
        proximo.origemPreco = ''
      }
      return proximo
    })
  }

  async function aoSelecionarProduto(produtoId: string) {
    if (!produtoId) {
      setRascunho(itemVazio())
      return
    }
    setPreenchendoProduto(true)
    setErroRascunho('')
    try {
      const preenchido = await onPreencherProduto(produtoId, rascunho)
      setRascunho(preenchido)
    } finally {
      setPreenchendoProduto(false)
      requestAnimationFrame(() => {
        document.getElementById('rascunho-item-quantidade')?.focus()
      })
    }
  }

  function confirmarRascunho() {
    confirmarRascunhoComItem(rascunhoRef.current)
  }

  function seguirAposValidacoes(atual: ItemPedido, indiceEdicaoAtual: number | null) {
    if (produtoJaExisteNosItens(itens, atual.produtoId, indiceEdicaoAtual)) {
      setItemDuplicadoPendente(atual)
      setIndiceEdicaoDuplicado(indiceEdicaoAtual)
      setConfirmacaoDuplicadoAberta(true)
      return
    }
    aplicarItemConfirmado(atual, indiceEdicaoAtual)
  }

  function confirmarRascunhoComItem(atual: ItemPedido) {
    if (!atual.produtoId) {
      setErroRascunho('Selecione o produto.')
      return
    }
    if (parseNum(atual.quantidade) <= 0) {
      setErroRascunho('Informe uma quantidade maior que zero.')
      return
    }

    const indiceEdicaoAtual = indiceEdicaoRef.current

    const produto = produtos.find((p) => p.id === atual.produtoId)
    const vinculo = produto ? obterVinculoFornecedor(produto, fornecedorPessoaId) : undefined
    const sugestao = sugerirQuantidadeMultiplo(
      parseNum(atual.quantidade),
      vinculo?.multiploEntrada
    )
    if (sugestao) {
      setItemMultiploPendente(atual)
      setQuantidadeSugeridaMultiplo(sugestao.quantidadeSugerida)
      setMultiploPendente(sugestao.multiplo)
      setConfirmacaoMultiploAberta(true)
      return
    }

    seguirAposValidacoes(atual, indiceEdicaoAtual)
  }

  function adequarQuantidadeMultiplo() {
    if (!itemMultiploPendente) return
    const ajustado = {
      ...itemMultiploPendente,
      quantidade: String(quantidadeSugeridaMultiplo),
    }
    setConfirmacaoMultiploAberta(false)
    setItemMultiploPendente(null)
    setRascunho(ajustado)
    rascunhoRef.current = ajustado
    seguirAposValidacoes(ajustado, indiceEdicaoRef.current)
  }

  function continuarSemAjusteMultiplo() {
    if (!itemMultiploPendente) return
    const atual = itemMultiploPendente
    setConfirmacaoMultiploAberta(false)
    setItemMultiploPendente(null)
    seguirAposValidacoes(atual, indiceEdicaoRef.current)
  }

  function confirmarProdutoDuplicado() {
    if (!itemDuplicadoPendente) return
    onSubstituirProdutoRef.current(itemDuplicadoPendente, indiceEdicaoDuplicado)
    limparRascunho()
    setConfirmacaoDuplicadoAberta(false)
    setItemDuplicadoPendente(null)
    setIndiceEdicaoDuplicado(null)
  }

  function cancelarProdutoDuplicado() {
    setConfirmacaoDuplicadoAberta(false)
    setItemDuplicadoPendente(null)
    setIndiceEdicaoDuplicado(null)
  }

  const adicionarAoEnterRef = useRef(() => {})
  adicionarAoEnterRef.current = () => {
    if (preenchendoProdutoRef.current) return
    const atual = rascunhoRef.current
    if (!atual.produtoId) return
    confirmarRascunhoComItem(atual)
  }

  useEffect(() => {
    if (disabled) return

    function aoTeclarEnter(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.shiftKey) return

      const container = containerRascunhoRef.current
      if (!container?.contains(e.target as Node)) return

      e.preventDefault()
      adicionarAoEnterRef.current()
    }

    document.addEventListener('keydown', aoTeclarEnter, true)
    return () => document.removeEventListener('keydown', aoTeclarEnter, true)
  }, [disabled])

  function carregarParaEdicao(linha: LinhaExibida) {
    if (disabled) return
    setRascunho({ ...linha.item })
    setIndiceEdicao(linha.indiceOriginal)
    setErroRascunho('')
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {itensLancados.length} produto{itensLancados.length !== 1 ? 's' : ''} lançado
          {itensLancados.length !== 1 ? 's' : ''}
        </p>
        {!disabled && editando && (
          <Button type="button" variant="ghost" size="sm" onClick={limparRascunho}>
            Cancelar edição
          </Button>
        )}
      </div>

      {!disabled && (
        <div
          ref={containerRascunhoRef}
          className="space-y-2 rounded-md bg-muted/20 p-2"
          data-area-rascunho-item
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <div className="sm:col-span-2 lg:col-span-3 2xl:col-span-2">
              <ComboboxProduto
                produtos={produtos}
                valor={rascunho.produtoId}
                aoMudar={(v) => void aoSelecionarProduto(v)}
                disabled={preenchendoProduto}
              />
            </div>
            <InputPadrao
              rotulo="Código original"
              value={rascunho.codigoOriginal}
              readOnly
              disabled
              placeholder="—"
              className="bg-muted/30"
              title="Editável no cadastro do produto, aba Compras"
            />
            <InputPadrao
              rotulo="Unidade"
              value={rascunho.unidade}
              readOnly
              disabled
              placeholder="—"
              className="bg-muted/30"
              title="Editável no cadastro do produto, aba Compras"
            />
            <InputPadrao
              id="rascunho-item-quantidade"
              rotulo="Quantidade"
              value={rascunho.quantidade}
              onChange={(e) => atualizarRascunho('quantidade', e.target.value)}
            />
            <InputPadrao
              rotulo="Itens por embalagem"
              value={rascunho.produtoId ? String(itensPorEmbalagemRascunho) : ''}
              readOnly
              disabled
              placeholder="—"
              className="bg-muted/30"
            />
            <InputPadrao
              rotulo="Múltiplo de compra"
              value={
                rascunho.produtoId && multiploEntradaRascunho != null && multiploEntradaRascunho > 0
                  ? String(multiploEntradaRascunho)
                  : ''
              }
              readOnly
              disabled
              placeholder="—"
              className="bg-muted/30"
            />
            <InputPadrao
              rotulo="Qtd total UN de venda"
              value={rascunho.produtoId ? String(qtdTotalUnRascunho) : ''}
              readOnly
              disabled
              placeholder="—"
              className="bg-muted/30"
            />
            <InputPadrao
              rotulo={rotuloPrecoRascunho}
              value={rascunho.precoUnitario}
              onChange={(e) => atualizarRascunho('precoUnitario', e.target.value)}
            />
            {precoUnitarioPreview != null && (
              <InputPadrao
                rotulo="Preço unitário (UN)"
                value={formatarMoeda(precoUnitarioPreview)}
                readOnly
                disabled
                className="bg-muted/30"
                title={
                  itensPorEmbalagemRascunho > 1
                    ? `${formatarMoeda(parseNum(rascunho.precoUnitario))} ÷ ${itensPorEmbalagemRascunho}`
                    : undefined
                }
              />
            )}
            <div>
              <p className="mb-2 text-sm font-medium leading-none">Total bruto</p>
              <p className="flex h-9 items-center text-sm font-medium tabular-nums">
                {formatarMoeda(totaisRascunho.bruto)}
              </p>
            </div>
          </div>

          {origemPrecoLabel && (
            <p className="text-xs text-muted-foreground">{origemPrecoLabel}</p>
          )}
          {produtoRascunho?.bloqueadoCompra && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-700">
              Produto bloqueado para compra no cadastro.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[5rem] flex-1 sm:max-w-[6rem]">
              <InputPadrao
                rotulo="% desc."
                value={rascunho.percentualDesconto}
                onChange={(e) => atualizarRascunho('percentualDesconto', e.target.value)}
              />
            </div>
            <div className="min-w-[5rem] flex-1 sm:max-w-[7rem]">
              <InputPadrao
                rotulo="R$ desc."
                value={rascunho.valorDesconto}
                onChange={(e) => atualizarRascunho('valorDesconto', e.target.value)}
              />
            </div>
            <div className="min-w-[5rem] flex-1 sm:max-w-[7rem]">
              <InputPadrao
                rotulo="Outras"
                value={rascunho.outrasDespesas}
                onChange={(e) => atualizarRascunho('outrasDespesas', e.target.value)}
              />
            </div>
            <div className="min-w-[5rem]">
              <p className="mb-2 text-sm font-medium leading-none">Líquido</p>
              <p className="flex h-9 items-center text-sm font-medium tabular-nums">
                {formatarMoeda(totaisRascunho.liquido)}
              </p>
            </div>
            <div className="min-w-[8rem] flex-1 sm:max-w-[10rem]">
              <InputPadrao
                rotulo="Prev. ent."
                type="date"
                value={rascunho.previsaoEntrega}
                onChange={(e) => atualizarRascunho('previsaoEntrega', e.target.value)}
              />
            </div>
            <div className="shrink-0">
              <BotaoPrimario
                type="button"
                disabled={preenchendoProduto}
                onClick={confirmarRascunho}
              >
                {editando ? (
                  'Atualizar'
                ) : (
                  <>
                    <Plus className="mr-1 size-4" />
                    Adicionar
                  </>
                )}
              </BotaoPrimario>
            </div>
          </div>

          {erroRascunho && <p className="text-sm text-destructive">{erroRascunho}</p>}
        </div>
      )}

      <p className="text-xs text-muted-foreground lg:hidden">
        Deslize horizontalmente para ver todas as colunas.
      </p>

      {!disabled && quantidadeSelecionada > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
          <p className="text-sm font-medium">
            {quantidadeSelecionada} item{quantidadeSelecionada !== 1 ? 'ns' : ''} selecionado
            {quantidadeSelecionada !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={desmarcarSelecao}>
              Desmarcar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirmacaoExclusaoMassaAberta(true)}
            >
              <Trash2 className="mr-1 size-4" />
              Excluir selecionados
            </Button>
          </div>
        </div>
      )}

      <div className="min-w-0 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[88rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="w-10 px-2 py-1.5">
                {!disabled && linhasExibidas.length > 0 ? (
                  <Checkbox
                    checked={estadoCheckboxCabecalho}
                    onCheckedChange={(valor) =>
                      alternarSelecaoTodosVisiveis(valor === true)
                    }
                    aria-label="Selecionar todos os itens visíveis"
                  />
                ) : null}
              </th>
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Produto"
                coluna="produto"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Marca"
                coluna="marca"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Cód. orig."
                coluna="codigoOriginal"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Unidade"
                coluna="unidade"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Qtd."
                coluna="quantidade"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Itens por Embalagem"
                coluna="itensPorEmbalagem"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Qtd total UN de Venda"
                coluna="qtdTotalUnVenda"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Preço"
                coluna="preco"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="% desc."
                coluna="pctDesconto"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="R$ desc."
                coluna="valorDesconto"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Outras"
                coluna="outras"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="T. bruto"
                coluna="totalBruto"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="T. líquido"
                coluna="totalLiquido"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Prev. ent."
                coluna="previsaoEntrega"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <th className="w-12 min-w-12 whitespace-nowrap px-2 py-1.5 font-medium text-muted-foreground">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {linhasExibidas.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum produto lançado. Preencha o formulário acima e clique em Adicionar.
                </td>
              </tr>
            ) : (
              linhasExibidas.map((linha) => {
                const totais = calcularTotalItem(linha.item)
                const selecionada = indiceEdicao === linha.indiceOriginal
                const marcada = indicesSelecionados.includes(linha.indiceOriginal)
                const nome = nomeProduto(linha.item, produtos)
                const urlFoto = urlFotoDoItem(linha.item, produtos)
                const embalagem = dadosEmbalagemDoItem(linha.item, produtos, fornecedorPessoaId)
                return (
                  <tr
                    key={linha.item.id ?? `item-${linha.indiceOriginal}`}
                    className={cn(
                      'group border-b border-border',
                      !disabled && 'cursor-pointer hover:bg-muted/30',
                      selecionada && 'bg-primary/5',
                      marcada && !selecionada && 'bg-muted/20'
                    )}
                    onClick={() => carregarParaEdicao(linha)}
                  >
                    <td
                      className="px-2 py-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!disabled ? (
                        <Checkbox
                          checked={marcada}
                          onCheckedChange={(valor) =>
                            alternarSelecaoLinha(linha.indiceOriginal, valor === true)
                          }
                          aria-label={`Selecionar ${nome}`}
                        />
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        {urlFoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={urlFoto}
                            alt={nome}
                            className="size-10 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="size-10 shrink-0 rounded bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{nome}</p>
                          {linha.item.produtoSku ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              SKU {linha.item.produtoSku}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">{marcaDoItem(linha.item, produtos)}</td>
                    <td className="px-2 py-1.5">{linha.item.codigoOriginal || '—'}</td>
                    <td className="px-2 py-1.5">{linha.item.unidade || '—'}</td>
                    <td className="px-2 py-1.5 tabular-nums">{linha.item.quantidade}</td>
                    <td className="px-2 py-1.5 tabular-nums">{embalagem.itensPorEmbalagem}</td>
                    <td className="px-2 py-1.5 tabular-nums">{embalagem.qtdTotalUnVenda}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatarMoeda(parseNum(linha.item.precoUnitario))}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{linha.item.percentualDesconto || '0'}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatarMoeda(parseNum(linha.item.valorDesconto))}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatarMoeda(parseNum(linha.item.outrasDespesas))}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{formatarMoeda(totais.bruto)}</td>
                    <td className="px-2 py-1.5 font-medium tabular-nums">
                      {formatarMoeda(totais.liquido)}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {linha.item.previsaoEntrega
                        ? formatarData(
                            /^\d{4}-\d{2}-\d{2}$/.test(linha.item.previsaoEntrega)
                              ? `${linha.item.previsaoEntrega}T12:00:00`
                              : linha.item.previsaoEntrega
                          )
                        : '—'}
                    </td>
                    <td
                      className={cn(
                        'w-12 min-w-12 whitespace-nowrap px-2 py-1.5',
                        !disabled && 'group-hover:bg-muted/30',
                        selecionada && 'bg-primary/5'
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title="Histórico de custo"
                          onClick={() => onAbrirHistorico(linha.item.produtoId)}
                        >
                          <History className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {ordenacao && (
        <p className="text-xs text-muted-foreground">
          Ordenação visual apenas. A ordem salva no pedido permanece a de lançamento.
        </p>
      )}

      <ModalConfirmacao
        aberto={confirmacaoExclusaoMassaAberta}
        titulo="Excluir itens selecionados"
        mensagem={`Deseja excluir ${quantidadeSelecionada} item${quantidadeSelecionada !== 1 ? 'ns' : ''} selecionado${quantidadeSelecionada !== 1 ? 's' : ''}?`}
        textoConfirmar="Excluir"
        textoCancelar="Cancelar"
        aoConfirmar={confirmarExclusaoMassa}
        aoCancelar={() => setConfirmacaoExclusaoMassaAberta(false)}
      />

      <ModalConfirmacao
        aberto={confirmacaoDuplicadoAberta}
        titulo="Produto já lançado"
        mensagem="Este produto já está no pedido. Deseja lançar novamente com dados diferentes? O lançamento anterior será removido."
        textoConfirmar="Substituir lançamento"
        textoCancelar="Cancelar"
        aoConfirmar={confirmarProdutoDuplicado}
        aoCancelar={cancelarProdutoDuplicado}
      />

      <ModalConfirmacao
        aberto={confirmacaoMultiploAberta}
        titulo="Múltiplo de compra"
        mensagem={`A quantidade informada (${itemMultiploPendente?.quantidade ?? ''}) não é múltiplo de ${multiploPendente}.\n\nDeseja adequar para ${quantidadeSugeridaMultiplo} ou continuar sem ajuste?`}
        textoConfirmar="Adequar quantidade"
        textoCancelar="Continuar sem ajuste"
        aoConfirmar={adequarQuantidadeMultiplo}
        aoCancelar={continuarSemAjusteMultiplo}
      />
    </div>
  )
}
