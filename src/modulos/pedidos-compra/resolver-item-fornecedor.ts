/**
 * Resolve unidade e código original do item conforme vínculo produto + fornecedor.
 * Espelha a lógica do frontend (preencher-item-pedido-compra.ts).
 */

export type VinculoFornecedorProduto = {
  fornecedorPessoaId: string
  codigoFornecedor: string | null
  unidadeEntrada: string | null
}

export type ProdutoComFornecedores = {
  id: string
  unidade: string
  fornecedores: VinculoFornecedorProduto[]
}

export function obterVinculoFornecedor(
  produto: ProdutoComFornecedores,
  fornecedorPessoaId: string
): VinculoFornecedorProduto | undefined {
  if (!fornecedorPessoaId) return undefined
  return produto.fornecedores.find((f) => f.fornecedorPessoaId === fornecedorPessoaId)
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

export function resolverUnidadeCodigoItem(
  produto: ProdutoComFornecedores,
  fornecedorPessoaId: string
): { unidade: string; codigoOriginal: string } {
  const vinculo = obterVinculoFornecedor(produto, fornecedorPessoaId)
  return {
    unidade: resolverUnidadeEntrada(vinculo, produto.unidade),
    codigoOriginal: resolverCodigoOriginal(vinculo),
  }
}
