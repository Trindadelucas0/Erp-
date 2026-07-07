/**
 * Geração de SKU numérico sequencial por empresa.
 */
import type { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

const SKU_NUMERICO = /^\d+$/

export function calcularProximoSkuNumerico(skus: (string | null | undefined)[]): string {
  const numeros = skus
    .filter((s): s is string => typeof s === 'string' && SKU_NUMERICO.test(s))
    .map((s) => Number(s))
  const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1
  return String(proximo)
}

async function listarSkusDaEmpresa(
  companyId: string,
  tx?: Prisma.TransactionClient
): Promise<(string | null)[]> {
  const db = tx ?? clientePrisma
  const produtos = await db.produto.findMany({
    where: { companyId },
    select: { sku: true },
  })
  return produtos.map((p) => p.sku)
}

export async function proximoSkuNumerico(
  companyId: string,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const skus = await listarSkusDaEmpresa(companyId, tx)
  return calcularProximoSkuNumerico(skus)
}
