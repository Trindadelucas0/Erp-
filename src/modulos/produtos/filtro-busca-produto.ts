/**
 * Filtro Prisma da listagem de produtos: §7.13 + ponto visual ignorado no SKU/nome.
 */
import type { Prisma } from '@prisma/client'
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
