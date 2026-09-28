import type { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

async function proximoNumero(companyId: string, tx: Prisma.TransactionClient) {
  const ultimo = await tx.vendaCaixa.findFirst({
    where: { companyId },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  return (ultimo?.numero ?? 0) + 1
}

async function executarEmTransacao<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return clientePrisma.$transaction(fn)
}

async function listar(companyId: string) {
  return clientePrisma.vendaCaixa.findMany({
    where: { companyId },
    orderBy: { numero: 'desc' },
    include: {
      requisicoes: {
        where: { tipoOperacao: 'separacao' },
        select: { numero: true },
        orderBy: { numero: 'asc' },
      },
    },
  })
}

export const repositorioDeVendasCaixa = {
  proximoNumero,
  executarEmTransacao,
  listar,
}
