export type VinculoFornecedorProduto = {
  fornecedorPessoaId: string
  codigoFornecedor: string | null
  unidadeEntrada: string | null
  multiploEntrada?: number | null
  multiplicadorEntrada?: number | null
}

export type ProdutoParaPreenchimento = {
  id: string
  nomeVenda: string
  sku: string | null
  marca?: string
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
  produtoMarca?: string | null
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

export function resolverItensPorEmbalagem(vinculo: VinculoFornecedorProduto | undefined): number {
  const valor = vinculo?.multiplicadorEntrada
  if (valor == null || !Number.isFinite(valor) || valor <= 0) return 1
  return valor
}

export function calcularQtdTotalUnVenda(quantidade: number, itensPorEmbalagem: number): number {
  if (!Number.isFinite(quantidade) || !Number.isFinite(itensPorEmbalagem)) return 0
  return Math.round(quantidade * itensPorEmbalagem * 1e6) / 1e6
}

function quantidadeEhMultiplo(quantidade: number, multiplo: number): boolean {
  if (!(multiplo > 0) || !(quantidade > 0)) return true
  const razao = quantidade / multiplo
  return Math.abs(razao - Math.round(razao)) < 1e-9
}

export function sugerirQuantidadeMultiplo(
  quantidade: number,
  multiploEntrada: number | null | undefined
): { precisaAjuste: true; quantidadeSugerida: number; multiplo: number } | null {
  if (multiploEntrada == null || !Number.isFinite(multiploEntrada) || multiploEntrada <= 0) {
    return null
  }
  if (multiploEntrada === 1) return null
  if (!(quantidade > 0)) return null
  if (quantidadeEhMultiplo(quantidade, multiploEntrada)) return null

  const sugerida = Math.ceil(quantidade / multiploEntrada - 1e-9) * multiploEntrada
  const quantidadeSugerida = Math.round(sugerida * 1e6) / 1e6
  return { precisaAjuste: true, quantidadeSugerida, multiplo: multiploEntrada }
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
    produtoMarca: produto.marca ?? null,
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
