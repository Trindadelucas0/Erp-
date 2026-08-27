export type RecorrenciaFinanceiraLista = {
  id: string
  companyId: string
  fornecedorPessoaId: string
  produtoId: string
  valor: number
  ativo: boolean
  createdAt: string
  updatedAt: string
  fornecedor: {
    id: string
    nome: string
    nomeFantasia: string | null
    documento: string | null
  } | null
  produto: {
    id: string
    nomeVenda: string
    sku: string | null
    unidade: string
  } | null
}
