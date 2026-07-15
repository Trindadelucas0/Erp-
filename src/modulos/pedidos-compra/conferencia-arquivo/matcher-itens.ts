/**
 * Casa itens do pedido com itens extraídos do arquivo do fornecedor.
 * Ordem de match (fechada em integração ia.md): código de barras → código
 * original/de origem → nome + preço (similaridade textual + tolerância de preço).
 * Não auto-aplica nada — só gera o relatório para decisão humana.
 */
import { diferencaPercentual, normalizarTexto, similaridadeNomes } from './comparar-valores.js'
import type {
  DivergenciaCampo,
  ItemExtraido,
  ItemPedidoParaMatch,
  LinhaResultadoConferencia,
  MetodoMatch,
} from './tipos-conferencia.js'

function compararItemPedidoComArquivo(
  pedido: ItemPedidoParaMatch,
  arquivo: ItemExtraido,
  toleranciaPreco: number
): DivergenciaCampo[] {
  const divergencias: DivergenciaCampo[] = []

  if (diferencaPercentual(pedido.quantidade, arquivo.quantidade) > 0.0001) {
    divergencias.push({
      campo: 'quantidade',
      esperado: String(pedido.quantidade),
      encontrado: String(arquivo.quantidade),
      severidade: 'alta',
    })
  }

  if (diferencaPercentual(pedido.precoUnitario, arquivo.precoUnitario) > toleranciaPreco) {
    divergencias.push({
      campo: 'precoUnitario',
      esperado: pedido.precoUnitario.toFixed(4),
      encontrado: arquivo.precoUnitario.toFixed(4),
      severidade: 'alta',
    })
  }

  return divergencias
}

export function compararItensPedidoComArquivo(
  itensPedido: ItemPedidoParaMatch[],
  itensArquivo: ItemExtraido[],
  opcoes: { limiarNome: number; toleranciaPreco: number }
): LinhaResultadoConferencia[] {
  const arquivoDisponivel = itensArquivo.map((item, index) => ({ item, index }))
  const usados = new Set<number>()
  const linhas: LinhaResultadoConferencia[] = []

  function marcarUsadoEProduzirLinha(
    pedido: ItemPedidoParaMatch,
    candidato: { item: ItemExtraido; index: number },
    metodo: MetodoMatch,
    confianca: number
  ) {
    usados.add(candidato.index)
    const divergencias = compararItemPedidoComArquivo(pedido, candidato.item, opcoes.toleranciaPreco)
    linhas.push({
      status: divergencias.length > 0 ? 'divergente' : 'ok',
      metodoMatch: metodo,
      confianca,
      pedido,
      arquivo: candidato.item,
      divergencias,
    })
  }

  for (const pedido of itensPedido) {
    const codigoBarrasPedido = normalizarTexto(pedido.codigoBarras)
    const candidatoBarras = codigoBarrasPedido
      ? arquivoDisponivel.find(
          (c) => !usados.has(c.index) && normalizarTexto(c.item.codigoBarras) === codigoBarrasPedido
        )
      : undefined

    if (candidatoBarras) {
      marcarUsadoEProduzirLinha(pedido, candidatoBarras, 'codigo_barras', 1)
      continue
    }

    const codigoOriginalPedido = normalizarTexto(pedido.codigoOriginal)
    const candidatoCodigo = codigoOriginalPedido
      ? arquivoDisponivel.find(
          (c) => !usados.has(c.index) && normalizarTexto(c.item.codigo) === codigoOriginalPedido
        )
      : undefined

    if (candidatoCodigo) {
      marcarUsadoEProduzirLinha(pedido, candidatoCodigo, 'codigo_original', 0.95)
      continue
    }

    let melhor: { candidato: (typeof arquivoDisponivel)[number]; score: number } | null = null
    for (const candidato of arquivoDisponivel) {
      if (usados.has(candidato.index)) continue
      const score = similaridadeNomes(pedido.nome, candidato.item.descricao)
      if (score >= opcoes.limiarNome && (!melhor || score > melhor.score)) {
        melhor = { candidato, score }
      }
    }

    if (melhor) {
      marcarUsadoEProduzirLinha(pedido, melhor.candidato, 'nome_preco', melhor.score)
      continue
    }

    linhas.push({
      status: 'sem_match_pedido',
      metodoMatch: 'nenhum',
      confianca: 0,
      pedido,
      divergencias: [],
    })
  }

  for (const candidato of arquivoDisponivel) {
    if (usados.has(candidato.index)) continue
    linhas.push({
      status: 'sobra_arquivo',
      metodoMatch: 'nenhum',
      confianca: 0,
      arquivo: candidato.item,
      divergencias: [],
    })
  }

  return linhas
}
