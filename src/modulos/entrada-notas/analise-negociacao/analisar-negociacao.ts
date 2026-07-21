/**
 * Etapa 3 — Análise de negociação (NF × pedido de compra).
 */
import type { ResultadoEtapa } from '../tipos-analise.js'

const TOLERANCIA_PRECO = 0.01
const TOLERANCIA_QTD = 0.0001

type ItemNf = {
  id: string
  produtoId: string | null
  quantidade: number | null
  valorUnitario: number | null
}

type ItemPo = {
  produtoId: string
  quantidade: number
  precoUnitario: number
  nome?: string
}

export type ClassificacaoNegociacao = 'ok' | 'positiva' | 'negativa' | 'sem_pedido'

export function analisarNegociacao(params: {
  itensNf: ItemNf[]
  pedido: {
    id: string
    numero: number
    condicaoPagamento: string | null
    prazosPagamento: unknown
    itens: ItemPo[]
  } | null
  prazoNf: string | null
  prazoInformadoUsuario: string | null
}): {
  resultado: ResultadoEtapa
  classificacao: ClassificacaoNegociacao
  itensCritica: Array<{ id: string; criticaNegociacao: boolean }>
} {
  const avisos: string[] = []
  const bloqueios: string[] = []
  const itensCritica: Array<{ id: string; criticaNegociacao: boolean }> = []

  if (!params.pedido) {
    bloqueios.push(
      'Nenhum pedido de compra aberto vinculado ao fornecedor. Selecione um pedido, libere críticas ou use Contato / Desconhecimento.'
    )
    for (const item of params.itensNf) {
      itensCritica.push({ id: item.id, criticaNegociacao: true })
    }
    return {
      resultado: { status: 'bloqueante', avisos, bloqueios },
      classificacao: 'sem_pedido',
      itensCritica,
    }
  }

  let temNegativa = false
  let temPositiva = false
  const usadosPo = new Set<string>()

  for (const item of params.itensNf) {
    let critica = false
    if (!item.produtoId) {
      itensCritica.push({ id: item.id, criticaNegociacao: false })
      continue
    }

    const candidato = params.pedido.itens.find(
      (p) => p.produtoId === item.produtoId && !usadosPo.has(`${p.produtoId}:${p.quantidade}:${p.precoUnitario}`)
    )

    if (!candidato) {
      bloqueios.push(`Item da NF não está no pedido #${params.pedido.numero}.`)
      critica = true
      temNegativa = true
      itensCritica.push({ id: item.id, criticaNegociacao: critica })
      continue
    }

    usadosPo.add(`${candidato.produtoId}:${candidato.quantidade}:${candidato.precoUnitario}`)

    const qtdNf = item.quantidade ?? 0
    const precoNf = item.valorUnitario ?? 0
    const nome = candidato.nome ?? candidato.produtoId

    if (Math.abs(qtdNf - candidato.quantidade) > TOLERANCIA_QTD) {
      if (qtdNf > candidato.quantidade) {
        bloqueios.push(
          `Quantidade maior que o pedido para ${nome} (NF ${qtdNf} × PO ${candidato.quantidade}).`
        )
        critica = true
        temNegativa = true
      } else {
        avisos.push(
          `Quantidade menor que o pedido para ${nome} (NF ${qtdNf} × PO ${candidato.quantidade}) — divergência positiva.`
        )
        temPositiva = true
      }
    }

    if (Math.abs(precoNf - candidato.precoUnitario) > TOLERANCIA_PRECO) {
      if (precoNf > candidato.precoUnitario) {
        bloqueios.push(
          `Preço maior que o pedido para ${nome} (NF ${precoNf} × PO ${candidato.precoUnitario}).`
        )
        critica = true
        temNegativa = true
      } else {
        avisos.push(
          `Preço menor que o pedido para ${nome} (NF ${precoNf} × PO ${candidato.precoUnitario}) — divergência positiva.`
        )
        temPositiva = true
      }
    }

    itensCritica.push({ id: item.id, criticaNegociacao: critica })
  }

  const prazoEfetivo = (params.prazoNf ?? params.prazoInformadoUsuario ?? '').trim()
  if (!prazoEfetivo) {
    bloqueios.push(
      'Prazo de pagamento não informado na NF. Preencha o prazo na tela ou libere críticas.'
    )
    temNegativa = true
  } else if (params.pedido.condicaoPagamento) {
    const poPrazo = params.pedido.condicaoPagamento.trim().toLowerCase()
    const nfPrazo = prazoEfetivo.toLowerCase()
    if (poPrazo && nfPrazo && poPrazo !== nfPrazo) {
      // prazo mais longo = positivo (heurística: se texto diferente, tratar como aviso se usuário liberou)
      avisos.push(
        `Prazo/condição diverge do pedido (NF: ${prazoEfetivo} × PO: ${params.pedido.condicaoPagamento}).`
      )
      temPositiva = true
    }
  }

  const classificacao: ClassificacaoNegociacao = temNegativa
    ? 'negativa'
    : temPositiva
      ? 'positiva'
      : 'ok'

  const status: ResultadoEtapa['status'] = temNegativa
    ? 'bloqueante'
    : avisos.length > 0
      ? 'aviso'
      : 'ok'

  return {
    resultado: {
      status,
      avisos,
      bloqueios,
      detalhes: { pedidoCompraId: params.pedido.id, numero: params.pedido.numero, classificacao },
    },
    classificacao,
    itensCritica,
  }
}
