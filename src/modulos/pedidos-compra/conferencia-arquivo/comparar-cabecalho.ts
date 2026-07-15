/**
 * Compara o cabeçalho extraído do arquivo com os dados do pedido de compra.
 * Condição de pagamento é texto livre — comparação textual normalizada,
 * sem exigir formato numérico (mesmo espírito de conferencia-po-entrada.ts).
 */
import { normalizarModalidadeTransporte } from '../modalidade-transporte.js'
import { normalizarTexto } from './comparar-valores.js'
import type { CabecalhoExtraido, DivergenciaCampo } from './tipos-conferencia.js'
import type { PedidoCompraView } from '../repositorio-pedidos-compra.js'

export function compararCabecalho(
  pedido: PedidoCompraView,
  cabecalho: CabecalhoExtraido
): DivergenciaCampo[] {
  const divergencias: DivergenciaCampo[] = []

  if (
    normalizarTexto(pedido.condicaoPagamento) &&
    normalizarTexto(cabecalho.condicaoPagamento) &&
    normalizarTexto(pedido.condicaoPagamento) !== normalizarTexto(cabecalho.condicaoPagamento)
  ) {
    divergencias.push({
      campo: 'condicaoPagamento',
      esperado: pedido.condicaoPagamento ?? '',
      encontrado: cabecalho.condicaoPagamento ?? '',
      severidade: 'media',
    })
  }

  const transportePedido = normalizarTexto(normalizarModalidadeTransporte(pedido.modalidadeTransporte))
  const transporteArquivo = normalizarTexto(normalizarModalidadeTransporte(cabecalho.modalidadeTransporte))
  if (transportePedido && transporteArquivo && transportePedido !== transporteArquivo) {
    divergencias.push({
      campo: 'modalidadeTransporte',
      esperado: pedido.modalidadeTransporte ?? '',
      encontrado: cabecalho.modalidadeTransporte ?? '',
      severidade: 'media',
    })
  }

  if (
    cabecalho.valorTotalGeral != null &&
    Math.abs(pedido.totalLiquido - cabecalho.valorTotalGeral) > 0.05 * Math.max(pedido.totalLiquido, 1)
  ) {
    divergencias.push({
      campo: 'valorTotalGeral',
      esperado: pedido.totalLiquido.toFixed(2),
      encontrado: cabecalho.valorTotalGeral.toFixed(2),
      severidade: 'baixa',
    })
  }

  return divergencias
}
