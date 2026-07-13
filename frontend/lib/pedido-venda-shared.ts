import type { ModoQuantidadeVenda } from '@/lib/regras-venda-produto'

export type ItemPedidoVenda = {
  id?: string
  produtoId: string
  produtoNome?: string
  produtoSku?: string | null
  modoQuantidade: ModoQuantidadeVenda
  quantidadeInformada: string
  quantidadeUnidadeVenda?: number
  itensPorEmbalagem?: number
  unidade: string
  precoUnitario: string
  total?: number
}

export type PedidoVenda = {
  id: string
  numero: number
  clienteNome: string
  status: string
  sobEncomenda: boolean
  observacoes: string | null
  totalLiquido: number
  itens: ItemPedidoVenda[]
  createdAt: string
  updatedAt: string
}

export type ProdutoVendaOpcao = {
  id: string
  nomeVenda: string
  sku: string | null
  unidade: string
  multiploVenda: number
  permiteVendaFracionada: boolean
  bloqueadoVenda: boolean
  precoCusto: number | null
  embalagensMaster: { quantidade: number }[]
  fornecedores: { multiplicadorEntrada: number | null }[]
}

export function itemVendaVazio(): ItemPedidoVenda {
  return {
    produtoId: '',
    modoQuantidade: 'UN',
    quantidadeInformada: '1',
    unidade: '',
    precoUnitario: '0',
  }
}

export function parseNum(v: string): number {
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function rotuloStatusVenda(status: string): string {
  if (status === 'rascunho' || status === 'aberto') return 'Rascunho'
  if (status === 'concluido') return 'Concluído'
  if (status === 'cancelado') return 'Cancelado'
  return status
}

export function pedidoVendaEditavel(status: string): boolean {
  return status === 'rascunho' || status === 'aberto'
}
