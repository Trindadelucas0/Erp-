import {
  FORMAS_PAGAMENTO_UI,
  rotuloFormaPagamento,
  type FormaPagamentoUi,
} from '@/lib/receber-pagamento-desenvolvimento'
import { OPCOES_CONDICAO_PAGAMENTO } from '@/lib/orcamento-layout'

export type OrcamentoRecebimento = {
  id: string
  numero: string
  data: string
  validade: string
  status: string
  vendedorId: string
  clienteNome: string
  cnpj: string
  telefone: string
  email: string
  condicaoPagamento: string
  descontoTotal: number
  valorFrete: number
  outrasDespesas: number
  total: number
  itens: Array<{
    id: string
    codigo: string
    descricao: string
    quantidade: number
    unidade: string
    precoUnitario: number
    percentualDesconto: number
  }>
  jaRecebido?: boolean
}

export type OrcamentoListaReceber = {
  id: string
  numero: string
  data: string
  clienteNome: string
  vendedorId: string
  condicaoPagamento: string
  total: number
  chamadoAtendente: boolean
  vendaChamadoId: string | null
}

const CONDICOES_SOMENTE_CAIXA = new Set(['dinheiro', 'a_vista', ''])

export function rotuloCondicaoPagamento(valor: string) {
  if (!valor) return '—'
  return OPCOES_CONDICAO_PAGAMENTO.find((item) => item.value === valor)?.label ?? valor
}

export function formaPadraoDoOrcamento(condicao: string): FormaPagamentoUi {
  const valores = FORMAS_PAGAMENTO_UI.map((f) => f.valor)
  if (valores.includes(condicao as FormaPagamentoUi)) {
    return condicao as FormaPagamentoUi
  }
  if (condicao === 'a_vista') return 'pix'
  return 'pix'
}

export function formaConfirmavelNoTotem(condicao: string, formaEscolhida: FormaPagamentoUi) {
  if (CONDICOES_SOMENTE_CAIXA.has(condicao)) return false
  if (formaEscolhida === 'dinheiro') return false
  return true
}

export function formaEhCartao(forma: FormaPagamentoUi) {
  return forma === 'cartao_credito' || forma === 'cartao_debito'
}

export function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function totalLinhaOrcamento(item: OrcamentoRecebimento['itens'][number]) {
  const preco4 = Math.round(item.precoUnitario * 10000)
  const liquido4 = Math.round((preco4 * (100 - item.percentualDesconto)) / 100)
  return (Math.round((liquido4 * item.quantidade) / 100) / 100)
}

export function rotuloFormaParaComprovante(forma: string | null | undefined) {
  return rotuloFormaPagamento(forma)
}
