import type { Prisma } from '@prisma/client'
import { arredondarQtd } from '../estoque/tipos-estoque.js'
import { repositorioDeRequisicoesWms } from '../requisicoes-wms/repositorio-requisicoes-wms.js'

export const TIPO_OS_SEPARACAO_VENDA = 'separacao' as const

export type ItemSeparacaoVenda = {
  produtoId: string
  quantidade: number
}

export function agruparItensVenda(
  itens: ItemSeparacaoVenda[]
): Array<{ produtoId: string; quantidade: number }> {
  const mapa = new Map<string, number>()
  for (const item of itens) {
    if (!item.produtoId) continue
    const qtd = arredondarQtd(Number(item.quantidade))
    if (!Number.isFinite(qtd) || qtd <= 0) continue
    mapa.set(item.produtoId, arredondarQtd((mapa.get(item.produtoId) ?? 0) + qtd))
  }
  return [...mapa.entries()].map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
}

export function observacaoOsSeparacaoVenda(numero: number) {
  return `Venda ${numero}`
}

export async function gerarOsSeparacaoDaVenda(params: {
  companyId: string
  vendaCaixaId: string
  numeroVenda: number
  usuarioId: string
  itens: ItemSeparacaoVenda[]
  tx?: Prisma.TransactionClient
}) {
  const agrupadas = agruparItensVenda(params.itens)
  if (agrupadas.length === 0) return []

  const observacao = observacaoOsSeparacaoVenda(params.numeroVenda)

  const run = async (tx: Prisma.TransactionClient) => {
    const criadas: Array<{ id: string; numero: number; produtoId: string }> = []
    for (const linha of agrupadas) {
      const existente = await tx.requisicaoWms.findFirst({
        where: {
          companyId: params.companyId,
          vendaCaixaId: params.vendaCaixaId,
          produtoId: linha.produtoId,
          tipoOperacao: TIPO_OS_SEPARACAO_VENDA,
        },
        select: { id: true, numero: true, produtoId: true },
      })
      if (existente?.produtoId) continue

      const numero = await repositorioDeRequisicoesWms.proximoNumero(params.companyId, tx)
      const row = await tx.requisicaoWms.create({
        data: {
          companyId: params.companyId,
          numero,
          tipoOperacao: TIPO_OS_SEPARACAO_VENDA,
          prioridade: 3,
          status: 'disponivel',
          origemEnderecoId: null,
          destinoEnderecoId: null,
          produtoId: linha.produtoId,
          quantidade: linha.quantidade,
          responsavelId: null,
          observacao,
          vendaCaixaId: params.vendaCaixaId,
          eventos: {
            create: {
              usuarioId: params.usuarioId,
              acao: 'criar',
              deStatus: null,
              paraStatus: 'disponivel',
            },
          },
        },
        select: { id: true, numero: true, produtoId: true },
      })
      if (!row.produtoId) continue
      criadas.push({ id: row.id, numero: row.numero, produtoId: row.produtoId })
    }
    return criadas
  }

  if (params.tx) return run(params.tx)
  return repositorioDeRequisicoesWms.executarEmTransacao(run)
}
