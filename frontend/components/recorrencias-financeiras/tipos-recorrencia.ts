export type RecorrenciaFinanceiraLista = {
  id: string
  companyId: string
  fornecedorPessoaId: string
  produtoId: string
  valor: number
  periodicidade: 'mensal' | 'anual' | string
  diaVencimento: number
  competenciaInicio: string
  competenciaFim: string | null
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

export type ItemAgendaRecorrencia = {
  recorrenciaId: string
  fornecedorNome: string
  servicoNome: string
  valor: number
  diaVencimento: number
  situacao: 'chegou' | 'aguardando'
}

export type AgendaRecorrencia = {
  competencia: string
  itens: ItemAgendaRecorrencia[]
  totalEsperado: number
  quantidadeRegras: number
  quantidadeChegou: number
}
