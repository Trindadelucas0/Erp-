import type { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { STATUS_CHAMADO_ATENDENTE, STATUS_VENDA_PAGA } from './esquema-vendas-caixa.js'

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

async function listarPagas(companyId: string) {
  return clientePrisma.vendaCaixa.findMany({
    where: { companyId, status: STATUS_VENDA_PAGA },
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

async function listarChamados(companyId: string) {
  return clientePrisma.vendaCaixa.findMany({
    where: { companyId, status: STATUS_CHAMADO_ATENDENTE },
    orderBy: { numero: 'asc' },
    select: {
      id: true,
      numero: true,
      clienteNome: true,
      status: true,
      formaPagamento: true,
      orcamentoId: true,
      itens: {
        select: {
          produtoId: true,
          quantidade: true,
          produto: { select: { nomeVenda: true } },
        },
      },
    },
  })
}

async function obterPorId(companyId: string, id: string) {
  return clientePrisma.vendaCaixa.findFirst({
    where: { companyId, id },
    include: {
      itens: {
        select: { produtoId: true, quantidade: true },
      },
    },
  })
}

async function obterPorOrcamentoId(companyId: string, orcamentoId: string) {
  return clientePrisma.vendaCaixa.findFirst({
    where: { companyId, orcamentoId },
    include: {
      itens: {
        select: { produtoId: true, quantidade: true },
      },
    },
  })
}

async function orcamentoIdsPagos(companyId: string) {
  const vendas = await clientePrisma.vendaCaixa.findMany({
    where: { companyId, status: STATUS_VENDA_PAGA, orcamentoId: { not: null } },
    select: { orcamentoId: true },
  })
  return new Set(vendas.map((venda) => venda.orcamentoId).filter(Boolean) as string[])
}

export const repositorioDeVendasCaixa = {
  proximoNumero,
  executarEmTransacao,
  listarPagas,
  listarChamados,
  obterPorId,
  obterPorOrcamentoId,
  orcamentoIdsPagos,
}
