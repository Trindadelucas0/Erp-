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
  if (formaEscolhida === 'dinheiro' || formaEscolhida === 'boleto') return false
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

export type ModoBuscaTotem = 'numero' | 'documento'

export function soDigitosTotem(texto: string) {
  return texto.replace(/\D/g, '')
}

export function termoBuscaTotem(modo: ModoBuscaTotem, digitos: string): string | null {
  const limpo = soDigitosTotem(digitos)
  if (modo === 'numero') {
    if (limpo.length < 1 || limpo.length > 6) return null
    return `ORC-${limpo.padStart(6, '0')}`
  }
  if (limpo.length === 11 || limpo.length === 14) return limpo
  return null
}

/** Normaliza leitura de leitor de código ou teclado físico (Enter). */
export function termoBuscaLeitor(texto: string): string | null {
  const trimmed = texto.trim()
  if (!trimmed) return null

  const orc = /^ORC-(\d+)$/i.exec(trimmed)
  if (orc) {
    const seq = orc[1]!
    if (seq.length >= 1 && seq.length <= 6) return `ORC-${seq.padStart(6, '0')}`
    return trimmed.toUpperCase()
  }

  const digitos = soDigitosTotem(trimmed)
  if (digitos.length === 11 || digitos.length === 14) return digitos
  if (digitos.length >= 1 && digitos.length <= 6) return `ORC-${digitos.padStart(6, '0')}`
  return null
}

export function limiteDigitosTotem(modo: ModoBuscaTotem) {
  return modo === 'numero' ? 6 : 14
}

export function formatarVisorTotem(modo: ModoBuscaTotem, digitos: string): string {
  const limpo = soDigitosTotem(digitos)
  if (modo === 'numero') {
    return limpo ? `ORC-${limpo}` : 'ORC-'
  }
  if (limpo.length <= 11) {
    return limpo
      .replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2}).*/, (_, a, b, c, d) => {
        let s = a
        if (b) s += `.${b}`
        if (c) s += `.${c}`
        if (d) s += `-${d}`
        return s
      })
      .replace(/\.$/, '')
  }
  return limpo
    .replace(/^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2}).*/, (_, a, b, c, d, e) => {
      let s = a
      if (b) s += `.${b}`
      if (c) s += `.${c}`
      if (d) s += `/${d}`
      if (e) s += `-${e}`
      return s
    })
    .replace(/[./]$/, '')
}
