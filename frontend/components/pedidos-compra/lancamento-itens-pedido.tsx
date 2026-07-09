'use client'

import { useEffect, useMemo, useState } from 'react'
import { History, Plus, Trash2 } from 'lucide-react'
import { ComboboxProduto } from '@/components/pedidos-compra/combobox-produto'
import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { InputPadrao } from '@/components/ui/input-padrao'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'
import { cn } from '@/lib/utils'
import {
  calcularTotalItem,
  itemVazio,
  parseNum,
  type ItemPedido,
  type ProdutoOpcao,
} from '@/lib/pedido-compra-shared'
import { recalcularCodigoUnidadeItem, rotuloOrigemPreco } from '@/lib/preencher-item-pedido-compra'
import { resolverUrlUpload } from '@/lib/resolver-url-upload'

type ColunaOrdenacao =
  | 'produto'
  | 'codigoOriginal'
  | 'unidade'
  | 'quantidade'
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
  onRemover: (indiceOriginal: number) => void
  onAbrirHistorico: (produtoId: string) => void
}

function nomeProduto(item: ItemPedido, produtos: ProdutoOpcao[]): string {
  if (item.produtoNome?.trim()) return item.produtoNome
  const produto = produtos.find((p) => p.id === item.produtoId)
  return produto?.nomeVenda ?? '—'
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
  onRemover,
  onAbrirHistorico,
}: Props) {
  const [rascunho, setRascunho] = useState<ItemPedido>(itemVazio())
  const [indiceEdicao, setIndiceEdicao] = useState<number | null>(null)
  const [erroRascunho, setErroRascunho] = useState('')
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<ColunaOrdenacao>()
  const [preenchendoProduto, setPreenchendoProduto] = useState(false)

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
        switch (coluna) {
          case 'produto':
            return nomeProduto(item, produtos)
          case 'codigoOriginal':
            return item.codigoOriginal || ''
          case 'unidade':
            return item.unidade || ''
          case 'quantidade':
            return parseNum(item.quantidade)
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
    [itensLancados, ordenacao, produtos]
  )

  const totaisRascunho = calcularTotalItem(rascunho)
  const origemPrecoLabel = rotuloOrigemPreco(rascunho.origemPreco)
  const produtoRascunho = produtos.find((p) => p.id === rascunho.produtoId)
  const editando = indiceEdicao != null

  function limparRascunho() {
    setRascunho(itemVazio())
    setIndiceEdicao(null)
    setErroRascunho('')
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
    }
  }

  function confirmarRascunho() {
    if (!rascunho.produtoId) {
      setErroRascunho('Selecione o produto.')
      return
    }
    if (parseNum(rascunho.quantidade) <= 0) {
      setErroRascunho('Informe uma quantidade maior que zero.')
      return
    }
    if (indiceEdicao != null) {
      onAtualizar(indiceEdicao, rascunho)
    } else {
      onAdicionar(rascunho)
    }
    limparRascunho()
  }

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
        <div className="space-y-2 rounded-md bg-muted/20 p-2">
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
              rotulo="Quantidade"
              value={rascunho.quantidade}
              onChange={(e) => atualizarRascunho('quantidade', e.target.value)}
            />
            <InputPadrao
              rotulo="Preço unitário"
              value={rascunho.precoUnitario}
              onChange={(e) => atualizarRascunho('precoUnitario', e.target.value)}
            />
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

      <div className="min-w-0 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[72rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <CabecalhoColunaOrdenavel
                className="px-2 py-1.5"
                rotulo="Produto"
                coluna="produto"
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
              <th className="sticky right-0 z-10 bg-muted/40 px-2 py-1.5 font-medium text-muted-foreground">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {linhasExibidas.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum produto lançado. Preencha o formulário acima e clique em Adicionar.
                </td>
              </tr>
            ) : (
              linhasExibidas.map((linha) => {
                const totais = calcularTotalItem(linha.item)
                const selecionada = indiceEdicao === linha.indiceOriginal
                const nome = nomeProduto(linha.item, produtos)
                const urlFoto = urlFotoDoItem(linha.item, produtos)
                return (
                  <tr
                    key={linha.item.id ?? `item-${linha.indiceOriginal}`}
                    className={cn(
                      'group border-b border-border',
                      !disabled && 'cursor-pointer hover:bg-muted/30',
                      selecionada && 'bg-primary/5'
                    )}
                    onClick={() => carregarParaEdicao(linha)}
                  >
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
                    <td className="px-2 py-1.5">{linha.item.codigoOriginal || '—'}</td>
                    <td className="px-2 py-1.5">{linha.item.unidade || '—'}</td>
                    <td className="px-2 py-1.5 tabular-nums">{linha.item.quantidade}</td>
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
                        'sticky right-0 z-10 bg-card px-2 py-1.5',
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
                        {!disabled && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Remover item"
                            onClick={() => {
                              onRemover(linha.indiceOriginal)
                              if (indiceEdicao === linha.indiceOriginal) {
                                limparRascunho()
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
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
    </div>
  )
}
