/**
 * Conferência PO × Entrada NF (preço, prazo, transporte).
 */
export type ItemConferenciaEntrada = {
  produtoId: string
  precoUnitario: number
}

export type DadosEntradaParaConferencia = {
  condicaoPagamento?: string | null
  transportadoraPessoaId?: string | null
  modalidadeTransporte?: string | null
  itens: ItemConferenciaEntrada[]
}

export type DivergenciaConferencia = {
  tipo: 'preco' | 'condicao_pagamento' | 'transportadora' | 'modalidade_transporte'
  mensagem: string
  produtoId?: string
  esperado?: string
  recebido?: string
}

export type PedidoCompraParaConferencia = {
  condicaoPagamento?: string | null
  transportadoraPessoaId?: string | null
  modalidadeTransporte?: string | null
  itens: {
    produtoId: string
    precoUnitario: number
    produto?: { nomeVenda: string }
  }[]
}

const TOLERANCIA_PRECO = 0.01

function normalizarTexto(valor?: string | null): string {
  return (valor ?? '').trim().toLowerCase()
}

export function conferirPedidoCompraComEntrada(
  pedido: PedidoCompraParaConferencia,
  entrada: DadosEntradaParaConferencia,
  toleranciaPreco = TOLERANCIA_PRECO
): DivergenciaConferencia[] {
  const divergencias: DivergenciaConferencia[] = []

  if (
    normalizarTexto(pedido.condicaoPagamento) &&
    normalizarTexto(entrada.condicaoPagamento) &&
    normalizarTexto(pedido.condicaoPagamento) !== normalizarTexto(entrada.condicaoPagamento)
  ) {
    divergencias.push({
      tipo: 'condicao_pagamento',
      mensagem: 'Condição de pagamento diverge do pedido de compra',
      esperado: pedido.condicaoPagamento ?? '',
      recebido: entrada.condicaoPagamento ?? '',
    })
  }

  if (
    pedido.transportadoraPessoaId &&
    entrada.transportadoraPessoaId &&
    pedido.transportadoraPessoaId !== entrada.transportadoraPessoaId
  ) {
    divergencias.push({
      tipo: 'transportadora',
      mensagem: 'Transportadora diverge do pedido de compra',
      esperado: pedido.transportadoraPessoaId,
      recebido: entrada.transportadoraPessoaId,
    })
  }

  if (
    normalizarTexto(pedido.modalidadeTransporte) &&
    normalizarTexto(entrada.modalidadeTransporte) &&
    normalizarTexto(pedido.modalidadeTransporte) !== normalizarTexto(entrada.modalidadeTransporte)
  ) {
    divergencias.push({
      tipo: 'modalidade_transporte',
      mensagem: 'Modalidade de transporte diverge do pedido de compra',
      esperado: pedido.modalidadeTransporte ?? '',
      recebido: entrada.modalidadeTransporte ?? '',
    })
  }

  for (const itemPo of pedido.itens) {
    const itemEntrada = entrada.itens.find((i) => i.produtoId === itemPo.produtoId)
    if (!itemEntrada) continue

    const diff = Math.abs(itemPo.precoUnitario - itemEntrada.precoUnitario)
    if (diff > toleranciaPreco) {
      const nome = itemPo.produto?.nomeVenda ?? itemPo.produtoId
      divergencias.push({
        tipo: 'preco',
        produtoId: itemPo.produtoId,
        mensagem: `Preço diverge para ${nome}`,
        esperado: itemPo.precoUnitario.toFixed(4),
        recebido: itemEntrada.precoUnitario.toFixed(4),
      })
    }
  }

  return divergencias
}
