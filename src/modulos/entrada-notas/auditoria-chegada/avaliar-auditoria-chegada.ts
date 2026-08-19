/**
 * Conferência em Aguardando chegada: preço vs última NF consolidada e nome NF × sistema.
 * Fonte: DOCUMENTACAO-SISTEMA.md §7.19.
 */
import { createHash } from 'node:crypto'
import {
  diferencaPercentual,
  similaridadeNomes,
} from '../../pedidos-compra/conferencia-arquivo/comparar-valores.js'

export const LIMIAR_VARIACAO_PRECO = 0.3
export const LIMIAR_SIMILARIDADE_NOME = 0.25

export type TipoAchadoChegada = 'preco' | 'nome'

export type AchadoAuditoriaChegada = {
  tipo: TipoAchadoChegada
  itemId: string
  nItem: number
  produtoId: string
  produto: string
  mensagem: string
  nomeNf?: string
  nomeSistema?: string
  similaridade?: number
  precoAtual?: number
  precoUltima?: number
  variacaoPercentual?: number
}

export type AuditoriaChegadaJson = {
  achados: AchadoAuditoriaChegada[]
  fingerprint: string
  aceitoEm?: string | null
}

export type ItemAuditoriaChegada = {
  id: string
  nItem: number
  produtoId: string | null
  descricao: string | null
  valorUnitario: number | null
  itensPorEmbalagem: number
  nomeSistema: string | null
}

export type UltimaEntradaPreco = {
  produtoId: string
  precoUnitarioVenda: number
}

export function precoUnitarioVenda(
  valorUnitario: number | null | undefined,
  itensPorEmbalagem: number
): number | null {
  if (valorUnitario == null || !Number.isFinite(valorUnitario)) return null
  const mult = itensPorEmbalagem > 0 ? itensPorEmbalagem : 1
  return valorUnitario / mult
}

export function fingerprintAchados(achados: AchadoAuditoriaChegada[]): string {
  const canonico = [...achados]
    .map((a) => ({
      tipo: a.tipo,
      itemId: a.itemId,
      nomeNf: a.nomeNf ?? '',
      nomeSistema: a.nomeSistema ?? '',
      precoAtual: a.precoAtual ?? null,
      precoUltima: a.precoUltima ?? null,
    }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId) || a.tipo.localeCompare(b.tipo))
  return createHash('sha1').update(JSON.stringify(canonico)).digest('hex')
}

export function aceiteValido(
  atual: Pick<AuditoriaChegadaJson, 'achados' | 'fingerprint'>,
  salvo: AuditoriaChegadaJson | null | undefined
): boolean {
  if (!atual.achados.length) return true
  if (!salvo?.aceitoEm) return false
  return salvo.fingerprint === atual.fingerprint && salvo.fingerprint === fingerprintAchados(atual.achados)
}

export function lerChegadaDeAnalise(analiseJson: unknown): AuditoriaChegadaJson | null {
  if (!analiseJson || typeof analiseJson !== 'object') return null
  const chegada = (analiseJson as { chegada?: unknown }).chegada
  if (!chegada || typeof chegada !== 'object') return null
  const c = chegada as AuditoriaChegadaJson
  if (!Array.isArray(c.achados) || typeof c.fingerprint !== 'string') return null
  return {
    achados: c.achados,
    fingerprint: c.fingerprint,
    aceitoEm: c.aceitoEm ?? null,
  }
}

function formatarMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function avaliarAuditoriaChegada(params: {
  itens: ItemAuditoriaChegada[]
  ultimaPorProduto: Map<string, UltimaEntradaPreco>
}): AuditoriaChegadaJson {
  const achados: AchadoAuditoriaChegada[] = []

  for (const item of params.itens) {
    if (!item.produtoId) continue
    const nomeNf = (item.descricao ?? '').trim()
    const nomeSistema = (item.nomeSistema ?? '').trim()
    const rotulo = nomeSistema || nomeNf || 'Produto'

    if (nomeNf && nomeSistema) {
      const similaridade = similaridadeNomes(nomeNf, nomeSistema)
      if (similaridade < LIMIAR_SIMILARIDADE_NOME) {
        achados.push({
          tipo: 'nome',
          itemId: item.id,
          nItem: item.nItem,
          produtoId: item.produtoId,
          produto: rotulo,
          mensagem: `Nome divergente — NF "${nomeNf}" × sistema "${nomeSistema}".`,
          nomeNf,
          nomeSistema,
          similaridade,
        })
      }
    }

    const precoAtual = precoUnitarioVenda(item.valorUnitario, item.itensPorEmbalagem)
    const ultima = params.ultimaPorProduto.get(item.produtoId)
    if (precoAtual != null && precoAtual > 0 && ultima && ultima.precoUnitarioVenda > 0) {
      const variacao = diferencaPercentual(precoAtual, ultima.precoUnitarioVenda)
      const variacaoSobreUltima =
        Math.abs(precoAtual - ultima.precoUnitarioVenda) / ultima.precoUnitarioVenda
      if (variacaoSobreUltima >= LIMIAR_VARIACAO_PRECO || variacao >= LIMIAR_VARIACAO_PRECO) {
        achados.push({
          tipo: 'preco',
          itemId: item.id,
          nItem: item.nItem,
          produtoId: item.produtoId,
          produto: rotulo,
          mensagem: `Preço diverge da última entrada — atual ${formatarMoeda(precoAtual)} × última ${formatarMoeda(ultima.precoUnitarioVenda)}.`,
          precoAtual,
          precoUltima: ultima.precoUnitarioVenda,
          variacaoPercentual: variacaoSobreUltima,
        })
      }
    }
  }

  return {
    achados,
    fingerprint: fingerprintAchados(achados),
    aceitoEm: null,
  }
}

export function pendenteLiberacaoChegada(
  avaliacao: AuditoriaChegadaJson,
  salvo: AuditoriaChegadaJson | null | undefined
): boolean {
  return !aceiteValido(avaliacao, salvo)
}
