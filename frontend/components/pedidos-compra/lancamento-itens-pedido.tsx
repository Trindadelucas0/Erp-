'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, History, Plus, Trash2 } from 'lucide-react'
import { ComboboxProduto } from '@/components/pedidos-compra/combobox-produto'
import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { InputPadrao } from '@/components/ui/input-padrao'
import { cn } from '@/lib/utils'
import {
  calcularTotalItem,
  itemVazio,
  parseNum,
  type ItemPedido,
  type ProdutoOpcao,
} from '@/lib/pedido-compra-shared'
import { rotuloOrigemPreco } from '@/lib/preencher-item-pedido-compra'

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

type Ordenacao = {
  coluna: ColunaOrdenacao
  direcao: 'asc' | 'desc'
}

type LinhaExibida = {
  item: ItemPedido
  indiceOriginal: number
}

type Props = {
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

function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

function valorOrdenacao(
  item: ItemPedido,
  coluna: ColunaOrdenacao,
  produtos: ProdutoOpcao[]
): string | number {
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
}

function CabecalhoOrdenavel({
  rotulo,
  coluna,
  ordenacao,
  onOrdenar,
}: {
  rotulo: string
  coluna: ColunaOrdenacao
  ordenacao: Ordenacao | null
  onOrdenar: (coluna: ColunaOrdenacao) => void
}) {
  const ativo = ordenacao?.coluna === coluna
  return (
    <th className="px-3 py-2 font-medium whitespace-nowrap">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          ativo ? 'text-foreground' : 'text-muted-foreground'
        )}
        onClick={() => onOrdenar(coluna)}
      >
        {rotulo}
        {ativo && ordenacao.direcao === 'asc' ? (
          <ArrowUp className="size-3.5 shrink-0" />
        ) : ativo && ordenacao.direcao === 'desc' ? (
          <ArrowDown className="size-3.5 shrink-0" />
        ) : (
          <ArrowUpDown className="size-3.5 shrink-0 opacity-50" />
        )}
      </button>
    </th>
  )
}

export function LancamentoItensPedido({
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
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(null)
  const [preenchendoProduto, setPreenchendoProduto] = useState(false)

  const itensLancados = useMemo(
    () =>
      itens
        .map((item, indiceOriginal) => ({ item, indiceOriginal }))
        .filter((linha) => !!linha.item.produtoId),
    [itens]
  )

  const linhasExibidas: LinhaExibida[] = useMemo(() => {
    if (!ordenacao) return itensLancados
    const { coluna, direcao } = ordenacao
    const fator = direcao === 'asc' ? 1 : -1
    return [...itensLancados].sort((a, b) => {
      const va = valorOrdenacao(a.item, coluna, produtos)
      const vb = valorOrdenacao(b.item, coluna, produtos)
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * fator
      }
      return compararTexto(String(va), String(vb)) * fator
    })
  }, [itensLancados, ordenacao, produtos])

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

  function alternarOrdenacao(coluna: ColunaOrdenacao) {
    setOrdenacao((atual) => {
      if (!atual || atual.coluna !== coluna) {
        return { coluna, direcao: 'asc' }
      }
      if (atual.direcao === 'asc') {
        return { coluna, direcao: 'desc' }
      }
      return null
    })
  }

  return (
    <div className="space-y-4">
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
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_5rem_6rem_7rem_7rem]">
            <ComboboxProduto
              produtos={produtos}
              valor={rascunho.produtoId}
              aoMudar={(v) => void aoSelecionarProduto(v)}
              disabled={preenchendoProduto}
            />
            <InputPadrao
              rotulo="Código original"
              value={rascunho.codigoOriginal}
              onChange={(e) => atualizarRascunho('codigoOriginal', e.target.value)}
            />
            <InputPadrao
              rotulo="Unidade"
              value={rascunho.unidade}
              onChange={(e) => atualizarRascunho('unidade', e.target.value)}
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[6rem_7rem_7rem_7rem_minmax(0,1fr)_auto]">
            <InputPadrao
              rotulo="% desconto"
              value={rascunho.percentualDesconto}
              onChange={(e) => atualizarRascunho('percentualDesconto', e.target.value)}
            />
            <InputPadrao
              rotulo="R$ desconto"
              value={rascunho.valorDesconto}
              onChange={(e) => atualizarRascunho('valorDesconto', e.target.value)}
            />
            <InputPadrao
              rotulo="Outras desp."
              value={rascunho.outrasDespesas}
              onChange={(e) => atualizarRascunho('outrasDespesas', e.target.value)}
            />
            <div>
              <p className="mb-2 text-sm font-medium leading-none">Total líquido</p>
              <p className="flex h-9 items-center text-sm font-medium tabular-nums">
                {formatarMoeda(totaisRascunho.liquido)}
              </p>
            </div>
            <InputPadrao
              rotulo="Prev. entrega"
              type="date"
              value={rascunho.previsaoEntrega}
              onChange={(e) => atualizarRascunho('previsaoEntrega', e.target.value)}
            />
            <div className="flex items-end">
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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <CabecalhoOrdenavel
                rotulo="Produto"
                coluna="produto"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                rotulo="Código original"
                coluna="codigoOriginal"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                rotulo="Unidade"
                coluna="unidade"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                rotulo="Quantidade"
                coluna="quantidade"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                rotulo="Preço"
                coluna="preco"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                rotulo="% desconto"
                coluna="pctDesconto"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                rotulo="R$ desconto"
                coluna="valorDesconto"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                rotulo="Outras desp."
                coluna="outras"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                rotulo="Total bruto"
                coluna="totalBruto"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                rotulo="Total líquido"
                coluna="totalLiquido"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <CabecalhoOrdenavel
                rotulo="Prev. entrega"
                coluna="previsaoEntrega"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <th className="px-3 py-2 font-medium text-muted-foreground">Ações</th>
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
                return (
                  <tr
                    key={linha.item.id ?? `item-${linha.indiceOriginal}`}
                    className={cn(
                      'border-b border-border',
                      !disabled && 'cursor-pointer hover:bg-muted/30',
                      selecionada && 'bg-primary/5'
                    )}
                    onClick={() => carregarParaEdicao(linha)}
                  >
                    <td className="px-3 py-2 font-medium">
                      {nomeProduto(linha.item, produtos)}
                      {linha.item.produtoSku ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          SKU {linha.item.produtoSku}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{linha.item.codigoOriginal || '—'}</td>
                    <td className="px-3 py-2">{linha.item.unidade || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{linha.item.quantidade}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatarMoeda(parseNum(linha.item.precoUnitario))}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{linha.item.percentualDesconto || '0'}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatarMoeda(parseNum(linha.item.valorDesconto))}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatarMoeda(parseNum(linha.item.outrasDespesas))}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatarMoeda(totais.bruto)}</td>
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {formatarMoeda(totais.liquido)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {linha.item.previsaoEntrega
                        ? formatarData(
                            /^\d{4}-\d{2}-\d{2}$/.test(linha.item.previsaoEntrega)
                              ? `${linha.item.previsaoEntrega}T12:00:00`
                              : linha.item.previsaoEntrega
                          )
                        : '—'}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
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
