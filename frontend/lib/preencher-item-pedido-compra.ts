export type VinculoFornecedorProduto = {
  fornecedorPessoaId: string
  codigoFornecedor: string | null
  unidadeEntrada: string | null
}

export type ProdutoParaPreenchimento = {
  id: string
  nomeVenda: string
  sku: string | null
  unidade: string
  codigoOrigem: string | null
  precoCusto: number | null
  bloqueadoCompra: boolean
  fornecedores: VinculoFornecedorProduto[]
}

export type HistoricoCompraItem = {
  precoCusto: number
  precoUnitario: number
}

export type ItemPedidoPreenchivel = {
  produtoId: string
  produtoNome?: string
  produtoSku?: string | null
  codigoOriginal: string
  quantidade: string
  unidade: string
  precoUnitario: string
  percentualDesconto: string
  valorDesconto: string
  outrasDespesas: string
  previsaoEntrega: string
  origemPreco?: 'estoque' | 'historico' | ''
}

export function obterVinculoFornecedor(
  produto: ProdutoParaPreenchimento,
  fornecedorPessoaId: string
): VinculoFornecedorProduto | undefined {
  if (!fornecedorPessoaId) return undefined
  return produto.fornecedores.find((f) => f.fornecedorPessoaId === fornecedorPessoaId)
}

export function resolverPrecoUnitario(
  precoCustoEstoque: number | null | undefined,
  historico: HistoricoCompraItem[]
): { valor: string; origem: 'estoque' | 'historico' | '' } {
  if (precoCustoEstoque != null && Number.isFinite(precoCustoEstoque) && precoCustoEstoque > 0) {
    return { valor: String(precoCustoEstoque), origem: 'estoque' }
  }
  const ultimo = historico[0]
  if (ultimo) {
    const custo = ultimo.precoCusto > 0 ? ultimo.precoCusto : ultimo.precoUnitario
    if (Number.isFinite(custo) && custo > 0) {
      return { valor: String(custo), origem: 'historico' }
    }
  }
  return { valor: '0', origem: '' }
}

export function resolverUnidadeEntrada(
  vinculo: VinculoFornecedorProduto | undefined,
  unidadeVenda: string
): string {
  return vinculo?.unidadeEntrada?.trim() || unidadeVenda
}

export function resolverCodigoOriginal(vinculo: VinculoFornecedorProduto | undefined): string {
  return vinculo?.codigoFornecedor?.trim() || ''
}

export function recalcularCodigoUnidadeItem(
  item: ItemPedidoPreenchivel,
  produto: ProdutoParaPreenchimento,
  fornecedorPessoaId: string
): ItemPedidoPreenchivel {
  const vinculo = obterVinculoFornecedor(produto, fornecedorPessoaId)
  return {
    ...item,
    unidade: resolverUnidadeEntrada(vinculo, produto.unidade),
    codigoOriginal: resolverCodigoOriginal(vinculo),
  }
}

export function preencherItemComProduto(
  item: ItemPedidoPreenchivel,
  produto: ProdutoParaPreenchimento,
  fornecedorPessoaId: string,
  previsaoEntregaCabecalho: string,
  historico: HistoricoCompraItem[] = []
): ItemPedidoPreenchivel {
  const vinculo = obterVinculoFornecedor(produto, fornecedorPessoaId)
  const { valor: preco, origem } = resolverPrecoUnitario(produto.precoCusto, historico)

  return {
    ...item,
    produtoId: produto.id,
    produtoNome: produto.nomeVenda,
    produtoSku: produto.sku,
    unidade: resolverUnidadeEntrada(vinculo, produto.unidade),
    codigoOriginal: resolverCodigoOriginal(vinculo),
    precoUnitario: preco,
    origemPreco: origem,
    percentualDesconto: '0',
    valorDesconto: '0',
    outrasDespesas: '0',
    previsaoEntrega: item.previsaoEntrega || previsaoEntregaCabecalho || '',
  }
}

export function rotuloOrigemPreco(origem: ItemPedidoPreenchivel['origemPreco']): string {
  if (origem === 'estoque') return 'Preço puxado do custo em estoque'
  if (origem === 'historico') return 'Preço puxado da última compra'
  return ''
}
