import type { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { unirParcelasCreditoTotem } from '../vendas-caixa/opcoes-totem-vendas.js'

export const CONDICOES_PAGAMENTO = ['dinheiro', 'pix', 'boleto', 'cartao_debito', 'cartao_credito'] as const
export type PagamentoOrcamento = {
  condicaoPagamento: string
  parametroBoletoId?: string | null
  prazosBoleto?: number[]
  parcelasCredito?: number | null
}

export async function opcoesPagamentoOrcamento(companyId: string, db: Prisma.TransactionClient = clientePrisma) {
  const [boletos, cartoes] = await Promise.all([
    db.configuracaoBoleto.findMany({
      where: { companyId, ativo: true }, orderBy: { nome: 'asc' },
      select: { id: true, nome: true, valorMinimo: true, valorMaximo: true, prazoMedioMaximoDias: true,
        permitirParcelamento: true, quantidadeMaximaParcelas: true },
    }),
    db.cartaoPagamento.findMany({ where: { companyId, ativo: true, tipo: 'credito' },
      include: { adquirente: true, taxas: true } }),
  ])
  return {
    boletos: boletos.map((b) => ({ ...b, valorMinimo: b.valorMinimo == null ? null : Number(b.valorMinimo),
      valorMaximo: b.valorMaximo == null ? null : Number(b.valorMaximo) })),
    parcelasCredito: unirParcelasCreditoTotem(cartoes).map((p) => p.numeroParcelas),
  }
}

export function dividirTotalPagamento(total: number, quantidade: number): number[] {
  const centavos = Math.round(total * 100)
  const base = Math.floor(centavos / quantidade)
  return Array.from({ length: quantidade }, (_, i) =>
    (i === quantidade - 1 ? centavos - base * (quantidade - 1) : base) / 100)
}

export function validarPagamentoOrcamento(dados: PagamentoOrcamento, total: number,
  opcoes: Awaited<ReturnType<typeof opcoesPagamentoOrcamento>>) {
  const recusar = (mensagem: string): never => { throw new ErroDaAplicacao(mensagem, 400) }
  if (!CONDICOES_PAGAMENTO.includes(dados.condicaoPagamento as typeof CONDICOES_PAGAMENTO[number])) {
    recusar('Selecione uma condição de pagamento válida.')
  }
  if (dados.condicaoPagamento === 'cartao_credito' && !opcoes.parcelasCredito.includes(dados.parcelasCredito ?? 0)) {
    recusar('Selecione uma quantidade de parcelas disponível nos cartões de crédito ativos.')
  }
  if (dados.condicaoPagamento !== 'boleto') return
  const parametro = opcoes.boletos.find((b) => b.id === dados.parametroBoletoId)
  if (!parametro) return recusar('Escolha um parâmetro de boleto ativo da empresa.')
  const prazos = dados.prazosBoleto ?? []
  if (!prazos.length || prazos.length > 500 || prazos.some((p, i) =>
    !Number.isSafeInteger(p) || p < 1 || p > 36500 || (i > 0 && p <= prazos[i - 1]))) {
    recusar('Informe prazos inteiros positivos em ordem crescente, por exemplo 28/56/84 (máximo de 36500 dias).')
  }
  if ((!parametro.permitirParcelamento && prazos.length > 1) ||
    (parametro.quantidadeMaximaParcelas != null && prazos.length > parametro.quantidadeMaximaParcelas)) {
    recusar('Quantidade de parcelas não permitida pelo parâmetro de boleto.')
  }
  if (parametro.prazoMedioMaximoDias != null && prazos.reduce((s, p) => s + p, 0) / prazos.length > parametro.prazoMedioMaximoDias) {
    recusar('Prazo médio excede o limite do parâmetro de boleto.')
  }
  if (dividirTotalPagamento(total, prazos.length).some((v) => v <= 0 ||
    (parametro.valorMinimo != null && v < parametro.valorMinimo) ||
    (parametro.valorMaximo != null && v > parametro.valorMaximo))) {
    recusar('Valor de cada boleto deve respeitar os limites do parâmetro e ser maior que zero.')
  }
}

export function dataCivilFechamento(data: Date) {
  return new Date(data.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) + 'T12:00:00Z')
}

export function parcelasBoletoNoFechamento(total: number, prazos: number[], data: Date) {
  const base = dataCivilFechamento(data)
  const valores = dividirTotalPagamento(total, prazos.length)
  return prazos.map((dias, i) => {
    const vencimento = new Date(base)
    vencimento.setUTCDate(vencimento.getUTCDate() + dias)
    return { numero: i + 1, dias, valor: valores[i], vencimento: vencimento.toISOString().slice(0, 10) }
  })
}
