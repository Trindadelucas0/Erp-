/**
 * Tipos e índices das colunas do relatório Santri ADM
 * "Relação de Produtos Analítico".
 */
export const COLUNAS_SANTRI = {
  codigo: 0,
  nome: 1,
  ncm: 2,
  nomeCompra: 3,
  fabricante: 4,
  marca: 5,
  ativo: 6,
  undVenda: 7,
  undCompra: 8,
  tipoControleEstoque: 9,
  aceitaEstoqueNegativo: 10,
  dataCadastro: 11,
  codigoOriginal: 12,
  codigoBarras: 13,
  bloqueadoCompras: 14,
  estoque: 19,
  preco: 20,
  multiploVenda: 21,
  multiploCompraUnitario: 22,
  multiploCompraSecundario: 23,
  undEntrega: 24,
  prontaEntrega: 25,
  kit: 26,
  pesoUnidade: 34,
  alturaUnidade: 35,
  larguraUnidade: 36,
  comprimentoUnidade: 37,
  pesoCaixa: 40,
  alturaCaixa: 41,
  larguraCaixa: 42,
  comprimentoCaixa: 43,
  capacidadeEmpilhamento: 46,
  origem: 52,
} as const

export type ProdutoSantriBruto = {
  linha: number
  codigo: string
  nome: string
  ncm: string
  nomeCompra: string
  fabricante: string
  marca: string
  ativo: string
  undVenda: string
  undCompra: string
  tipoControleEstoque: string
  aceitaEstoqueNegativo: string
  codigoOriginal: string
  codigoBarras: string
  bloqueadoCompras: string
  estoque: string
  preco: string
  multiploVenda: string
  multiploCompraUnitario: string
  multiploCompraSecundario: string
  undEntrega: string
  prontaEntrega: string
  kit: string
  pesoUnidade: string
  alturaUnidade: string
  larguraUnidade: string
  comprimentoUnidade: string
  pesoCaixa: string
  alturaCaixa: string
  larguraCaixa: string
  comprimentoCaixa: string
  capacidadeEmpilhamento: string
  origem: string
}
