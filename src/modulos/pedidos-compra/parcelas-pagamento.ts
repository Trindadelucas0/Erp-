/**
 * Rateio de parcelas do pedido de compra (Igual / Manual).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

export const TOLERANCIA_PARCELAS = 0.01

export type PrazoPagamentoNormalizado = {
  numero: number
  vencimento: string
  valor: number
}

export function distribuirParcelasIguais(totalParcelas: number, total: number): number[] {
  if (totalParcelas <= 0) return []
  if (total <= 0) return Array(totalParcelas).fill(0)
  const base = Math.floor((total / totalParcelas) * 100) / 100
  const valores = Array(totalParcelas).fill(base)
  const soma = valores.reduce((s, v) => s + v, 0)
  valores[valores.length - 1] = Math.round((valores[valores.length - 1] + (total - soma)) * 100) / 100
  return valores
}

export function calcularTotalLiquidoItem(item: {
  quantidade: number
  precoUnitario: number
  percentualDesconto?: number | null
  valorDesconto?: number | null
  outrasDespesas?: number | null
}) {
  const bruto = Math.round(item.quantidade * item.precoUnitario * 100) / 100
  let desconto = item.valorDesconto ?? 0
  if (item.percentualDesconto != null && item.percentualDesconto > 0) {
    desconto = Math.max(desconto, Math.round(bruto * (item.percentualDesconto / 100) * 100) / 100)
  }
  const outras = item.outrasDespesas ?? 0
  return Math.round((bruto - desconto + outras) * 100) / 100
}

export function calcularTotalLiquidoPedido(
  itens: {
    quantidade: number
    precoUnitario: number
    percentualDesconto?: number | null
    valorDesconto?: number | null
    outrasDespesas?: number | null
  }[],
  valorFrete?: number | null,
  creditoAplicado?: number | null
) {
  const itensTotal = itens.reduce((s, i) => s + calcularTotalLiquidoItem(i), 0)
  const frete = valorFrete ?? 0
  const credito = creditoAplicado ?? 0
  return Math.round((itensTotal + frete - credito) * 100) / 100
}

function parseValorParcela(valor: unknown): number | null {
  if (valor == null || valor === '') return null
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export function normalizarPrazosPagamento(
  prazos: { numero: number; vencimento: string; valor?: number | null }[] | null | undefined,
  rateioParcelas: 'igual' | 'manual' | undefined,
  totalLiquido: number
): PrazoPagamentoNormalizado[] | null {
  if (!prazos?.length) return null

  const comVencimento = prazos.filter((p) => p.vencimento?.trim())
  if (!comVencimento.length) return null

  const rateio = rateioParcelas ?? 'igual'

  if (rateio === 'igual') {
    const valores = distribuirParcelasIguais(comVencimento.length, totalLiquido)
    return comVencimento.map((p, i) => ({
      numero: p.numero,
      vencimento: p.vencimento,
      valor: valores[i] ?? 0,
    }))
  }

  const normalizados: PrazoPagamentoNormalizado[] = []
  for (const p of comVencimento) {
    const valor = parseValorParcela(p.valor)
    if (valor == null || valor <= 0) {
      throw new ErroDaAplicacao('Informe o valor (R$) de cada parcela no rateio manual', 400)
    }
    normalizados.push({ numero: p.numero, vencimento: p.vencimento, valor })
  }

  const soma = normalizados.reduce((s, p) => s + p.valor, 0)
  if (Math.abs(soma - totalLiquido) > TOLERANCIA_PARCELAS) {
    throw new ErroDaAplicacao(
      `Soma das parcelas (${soma.toFixed(2)}) difere do total líquido (${totalLiquido.toFixed(2)})`,
      400
    )
  }

  return normalizados
}

export function validarSomaParcelasManual(
  prazos: { vencimento: string; valor?: number | string | null }[],
  totalLiquido: number
): string | null {
  const comVencimento = prazos.filter((p) => p.vencimento?.trim())
  if (!comVencimento.length) return null

  for (const p of comVencimento) {
    const valor = parseValorParcela(p.valor)
    if (valor == null || valor <= 0) {
      return 'Informe o valor (R$) de cada parcela com vencimento no rateio manual.'
    }
  }

  const soma = comVencimento.reduce((s, p) => s + (parseValorParcela(p.valor) ?? 0), 0)
  if (Math.abs(soma - totalLiquido) > TOLERANCIA_PARCELAS) {
    return `Soma das parcelas (${soma.toFixed(2)}) difere do total líquido (${totalLiquido.toFixed(2)}).`
  }

  return null
}
