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
  embalagensMaster?: { quantidade: number | null }[]
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

function fatorEmbalagemValido(valor: number | null | undefined): valor is number {
  return valor != null && Number.isFinite(valor) && valor > 0
}

/**
 * Resolve itens por embalagem no PO:
 * 1) multiplicador do vínculo do fornecedor do pedido
 * 2) embalagem master
 * 3) qualquer multiplicador > 1 dos fornecedores do produto
 * 4) 1
 */
export function resolverItensPorEmbalagem(
  vinculoOuProduto?: VinculoFornecedorProduto | ProdutoParaPreenchimento | null,
  fornecedorPessoaId?: string
): number {
  // Compat: chamada antiga só com vínculo
  if (
    vinculoOuProduto &&
    'multiplicadorEntrada' in vinculoOuProduto &&
    !('fornecedores' in vinculoOuProduto)
  ) {
    const valor = vinculoOuProduto.multiplicadorEntrada
    return fatorEmbalagemValido(valor) ? valor : 1
  }

  const produto = vinculoOuProduto as ProdutoParaPreenchimento | null | undefined
  if (!produto) return 1

  const vinculo =
    fornecedorPessoaId != null
      ? obterVinculoFornecedor(produto, fornecedorPessoaId)
      : undefined
  if (fatorEmbalagemValido(vinculo?.multiplicadorEntrada)) {
    return vinculo.multiplicadorEntrada
  }

  const master = produto.embalagensMaster?.[0]?.quantidade
  if (fatorEmbalagemValido(master)) return master

  const outro = produto.fornecedores.find(
    (f) =>
      fatorEmbalagemValido(f.multiplicadorEntrada) && f.multiplicadorEntrada > 1
  )
  if (outro && fatorEmbalagemValido(outro.multiplicadorEntrada)) {
    return outro.multiplicadorEntrada
  }

  return 1
}

export function calcularQtdTotalUnVenda(quantidade: number, itensPorEmbalagem: number): number {
  if (!Number.isFinite(quantidade) || !Number.isFinite(itensPorEmbalagem)) return 0
  return Math.round(quantidade * itensPorEmbalagem * 1e6) / 1e6
}

/** Preço digitado no rascunho: embalagem quando fator > 1; caso contrário unitário. */
export function rotuloCampoPrecoEntrada(itensPorEmbalagem: number): string {
  return itensPorEmbalagem > 1 ? 'Preço da embalagem' : 'Preço unitário'
}

/**
 * Preview do preço por UN de venda quando o valor digitado é da embalagem.
 * Persistência do item continua com o preço na unidade de entrada (sem conversão).
 */
export function calcularPrecoUnitarioPreview(
  precoInformado: number,
  itensPorEmbalagem: number
): number | null {
  if (!(itensPorEmbalagem > 1)) return null
  if (!(precoInformado >= 0) || !Number.isFinite(precoInformado)) return null
  return Math.round((precoInformado / itensPorEmbalagem) * 1e6) / 1e6
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
