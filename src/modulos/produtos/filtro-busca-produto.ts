/**
 * Filtro Prisma da listagem de produtos: §7.13 + ponto visual ignorado no SKU/nome.
 */
import type { Prisma } from '@prisma/client'
import { montarFiltroBuscaCamposEscalares } from '../../compartilhado/utilitarios/filtro-busca-textual.js'
import { tokensSkuParaBusca } from './normalizar-sku.js'

const MODE_CI = 'insensitive' as const

export function escaparCuringasLike(valor: string): string {
  return valor.replace(/[%_\\]/g, '')
}

export function orProdutoPorToken(
  token: string,
  idsCamposSemPonto: string[] = []
): Prisma.ProdutoWhereInput {
  const or: Prisma.ProdutoWhereInput[] = [
    { nomeVenda: { contains: token, mode: MODE_CI } },
    { sku: { contains: token, mode: MODE_CI } },
    { codigoBarras: { contains: token, mode: MODE_CI } },
    { marca: { contains: token, mode: MODE_CI } },
    {
      embalagensMaster: {
        some: {
          codigoBarras: { contains: token, mode: MODE_CI },
        },
      },
    },
  ]

  for (const extra of tokensSkuParaBusca(token)) {
    if (extra === token) continue
    or.push({ sku: { contains: extra, mode: MODE_CI } })
    or.push({ nomeVenda: { contains: extra, mode: MODE_CI } })
  }

  if (idsCamposSemPonto.length) {
    or.push({ id: { in: idsCamposSemPonto } })
  }

  return { OR: or }
}

/** Filtro extra só em `Produto.marca` (tokens AND, contains CI). */
export function filtroMarcaProduto(
  termo: string | null | undefined
): Prisma.ProdutoWhereInput | undefined {
  return montarFiltroBuscaCamposEscalares(termo, ['marca']) as
    | Prisma.ProdutoWhereInput
    | undefined
}

export function andWhereProduto(
  ...partes: Array<Prisma.ProdutoWhereInput | undefined>
): Prisma.ProdutoWhereInput {
  const vivos = partes.filter(
    (parte): parte is Prisma.ProdutoWhereInput =>
      Boolean(parte && Object.keys(parte).length > 0)
  )
  if (vivos.length === 0) return {}
  if (vivos.length === 1) return vivos[0]!
  return { AND: vivos }
}
