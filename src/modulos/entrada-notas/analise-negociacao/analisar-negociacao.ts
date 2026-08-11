/**
 * Etapa 3 — Análise de negociação (NF × pedido de compra).
 */
import type { ResultadoEtapa } from '../tipos-analise.js'
import {
  formatarDiasPrazo,
  normalizarPrazoParaDias,
  prazosIguais,
} from './normalizar-prazo-negociacao.js'

const TOLERANCIA_PRECO = 0.01
const TOLERANCIA_QTD = 0.0001

export type CategoriaAchadoNegociacao =
  | 'fora_pedido'
  | 'quantidade'
  | 'preco'
  | 'prazo'
  | 'pedido'

export type AchadoNegociacao = {
  categoria: CategoriaAchadoNegociacao
  severidade: 'bloqueio' | 'aviso'
  mensagem: string
  /** Nome do produto (quando o achado é por item). */
  produto?: string
  /** Valor na NF (quantidade ou preço unitário). */
  valorNf?: number
  /** Valor no pedido (quantidade ou preço unitário). */
  valorPedido?: number
  /** Número do pedido de compra vinculado. */
  numeroPedido?: number
}

type ItemNf = {
  id: string
  produtoId: string | null
  quantidade: number | null
  valorUnitario: number | null
  /** Nome de venda do produto no sistema (preferencial). */
  nomeSistema?: string | null
  /** xProd da NF — fallback se não houver nomeSistema. */
  descricaoNf?: string | null
}

type ItemPo = {
  produtoId: string
  quantidade: number
  precoUnitario: number
  nome?: string
}

export type ClassificacaoNegociacao = 'ok' | 'positiva' | 'negativa' | 'sem_pedido'

function rotuloProduto(...candidatos: Array<string | null | undefined>): string {
  for (const c of candidatos) {
    const t = (c ?? '').trim()
    if (t) return t
  }
  return 'Produto'
}

function formatarNumero(n: number, casas = 4): string {
  if (!Number.isFinite(n)) return String(n)
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  })
}

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
  /** Emissão da NF — base para converter dVenc em dias. */
  dataEmissao?: Date | string | null
  /** Consumo/Prestador documental: não exige PO. */
  modoDocumental?: boolean
}): {
  resultado: ResultadoEtapa
  classificacao: ClassificacaoNegociacao
  itensCritica: Array<{ id: string; criticaNegociacao: boolean }>
} {
  const avisos: string[] = []
  const bloqueios: string[] = []
  const achados: AchadoNegociacao[] = []
  const itensCritica: Array<{ id: string; criticaNegociacao: boolean }> = []
  const modoDocumental = params.modoDocumental === true

  function pushAchado(achado: AchadoNegociacao) {
    achados.push(achado)
    if (achado.severidade === 'bloqueio') bloqueios.push(achado.mensagem)
    else avisos.push(achado.mensagem)
  }

  if (!params.pedido) {
    if (modoDocumental) {
      pushAchado({
        categoria: 'pedido',
        severidade: 'aviso',
        mensagem:
          'Entrada documental (uso/consumo): pedido de compra não exigido — liberação sem casamento com PO.',
      })
      for (const item of params.itensNf) {
        itensCritica.push({ id: item.id, criticaNegociacao: false })
      }
      return {
        resultado: {
          status: avisos.length > 0 ? 'aviso' : 'ok',
          avisos,
          bloqueios,
          detalhes: { achados, classificacao: 'sem_pedido' },
        },
        classificacao: 'sem_pedido',
        itensCritica,
      }
    }
    pushAchado({
      categoria: 'pedido',
      severidade: 'bloqueio',
      mensagem:
        'Nenhum pedido de compra aberto vinculado ao fornecedor. Selecione um pedido, libere críticas ou use Contato / Desconhecimento.',
    })
    for (const item of params.itensNf) {
      itensCritica.push({ id: item.id, criticaNegociacao: true })
    }
    return {
      resultado: {
        status: 'bloqueante',
        avisos,
        bloqueios,
        detalhes: { achados, classificacao: 'sem_pedido' },
      },
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

    const nomeItem = rotuloProduto(item.nomeSistema, item.descricaoNf)

    if (!candidato) {
      pushAchado({
        categoria: 'fora_pedido',
        severidade: 'bloqueio',
        mensagem: `${nomeItem} não está no pedido #${params.pedido.numero}.`,
        produto: nomeItem,
        numeroPedido: params.pedido.numero,
      })
      critica = true
      temNegativa = true
      itensCritica.push({ id: item.id, criticaNegociacao: critica })
      continue
    }

    usadosPo.add(`${candidato.produtoId}:${candidato.quantidade}:${candidato.precoUnitario}`)

    const qtdNf = item.quantidade ?? 0
    const precoNf = item.valorUnitario ?? 0
    const nome = rotuloProduto(item.nomeSistema, candidato.nome, item.descricaoNf)

    if (Math.abs(qtdNf - candidato.quantidade) > TOLERANCIA_QTD) {
      if (qtdNf > candidato.quantidade) {
        pushAchado({
          categoria: 'quantidade',
          severidade: 'bloqueio',
          mensagem: `Quantidade acima do pedido — ${nome} (NF ${formatarNumero(qtdNf)} × pedido ${formatarNumero(candidato.quantidade)}).`,
          produto: nome,
          valorNf: qtdNf,
          valorPedido: candidato.quantidade,
          numeroPedido: params.pedido.numero,
        })
        critica = true
        temNegativa = true
      } else {
        pushAchado({
          categoria: 'quantidade',
          severidade: 'aviso',
          mensagem: `Quantidade abaixo do pedido — ${nome} (NF ${formatarNumero(qtdNf)} × pedido ${formatarNumero(candidato.quantidade)}).`,
          produto: nome,
          valorNf: qtdNf,
          valorPedido: candidato.quantidade,
          numeroPedido: params.pedido.numero,
        })
        temPositiva = true
      }
    }

    if (Math.abs(precoNf - candidato.precoUnitario) > TOLERANCIA_PRECO) {
      if (precoNf > candidato.precoUnitario) {
        pushAchado({
          categoria: 'preco',
          severidade: 'bloqueio',
          mensagem: `Preço acima do pedido — ${nome} (NF ${formatarNumero(precoNf)} × pedido ${formatarNumero(candidato.precoUnitario)}).`,
          produto: nome,
          valorNf: precoNf,
          valorPedido: candidato.precoUnitario,
          numeroPedido: params.pedido.numero,
        })
        critica = true
        temNegativa = true
      } else {
        pushAchado({
          categoria: 'preco',
          severidade: 'aviso',
          mensagem: `Preço abaixo do pedido — ${nome} (NF ${formatarNumero(precoNf)} × pedido ${formatarNumero(candidato.precoUnitario)}).`,
          produto: nome,
          valorNf: precoNf,
          valorPedido: candidato.precoUnitario,
          numeroPedido: params.pedido.numero,
        })
        temPositiva = true
      }
    }

    itensCritica.push({ id: item.id, criticaNegociacao: critica })
  }

  const prazoEfetivo = (params.prazoNf ?? params.prazoInformadoUsuario ?? '').trim()
  if (!prazoEfetivo) {
    pushAchado({
      categoria: 'prazo',
      severidade: 'bloqueio',
      mensagem:
        'Prazo de pagamento não informado na NF. Preencha o prazo na tela ou libere críticas.',
    })
    temNegativa = true
  } else if (params.pedido.condicaoPagamento) {
    const diasNf = normalizarPrazoParaDias(prazoEfetivo, params.dataEmissao)
    const diasPedido = normalizarPrazoParaDias(params.pedido.condicaoPagamento)
    if (diasNf && diasPedido) {
      if (!prazosIguais(diasNf, diasPedido)) {
        pushAchado({
          categoria: 'prazo',
          severidade: 'aviso',
          mensagem: `Prazo de pagamento diverge do pedido (NF: ${formatarDiasPrazo(diasNf)} × pedido: ${formatarDiasPrazo(diasPedido)}).`,
        })
        temPositiva = true
      }
    } else {
      const poPrazo = params.pedido.condicaoPagamento.trim().toLowerCase()
      const nfPrazo = prazoEfetivo.toLowerCase()
      if (poPrazo && nfPrazo && poPrazo !== nfPrazo) {
        const rotuloNf = diasNf ? formatarDiasPrazo(diasNf) : prazoEfetivo
        const rotuloPedido = diasPedido
          ? formatarDiasPrazo(diasPedido)
          : params.pedido.condicaoPagamento
        pushAchado({
          categoria: 'prazo',
          severidade: 'aviso',
          mensagem: `Prazo de pagamento diverge do pedido (NF: ${rotuloNf} × pedido: ${rotuloPedido}).`,
        })
        temPositiva = true
      }
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
      detalhes: {
        pedidoCompraId: params.pedido.id,
        numero: params.pedido.numero,
        classificacao,
        achados,
      },
    },
    classificacao,
    itensCritica,
  }
}
