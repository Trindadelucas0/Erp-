import type { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

async function listar(
  companyId: string,
  filtro: { q?: string; incluirInativos?: boolean; somenteAtivos?: boolean }
) {
  const where: Prisma.ConfiguracaoBoletoWhereInput = { companyId }

  if (filtro.somenteAtivos) {
    where.ativo = true
  } else if (!filtro.incluirInativos) {
    where.ativo = true
  }

  const q = filtro.q?.trim()
  if (q) {
    where.nome = { contains: q, mode: 'insensitive' }
  }

  return clientePrisma.configuracaoBoleto.findMany({
    where,
    orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
  })
}

async function buscarPorId(companyId: string, id: string) {
  return clientePrisma.configuracaoBoleto.findFirst({
    where: { id, companyId },
  })
}

async function buscarPorNome(companyId: string, nome: string, excluirId?: string) {
  return clientePrisma.configuracaoBoleto.findFirst({
    where: {
      companyId,
      nome: { equals: nome, mode: 'insensitive' },
      ...(excluirId ? { NOT: { id: excluirId } } : {}),
    },
  })
}

async function criar(data: Prisma.ConfiguracaoBoletoUncheckedCreateInput) {
  return clientePrisma.configuracaoBoleto.create({ data })
}

async function atualizar(
  companyId: string,
  id: string,
  data: Prisma.ConfiguracaoBoletoUncheckedUpdateInput
) {
  return clientePrisma.configuracaoBoleto.updateMany({
    where: { id, companyId },
    data: { ...data, updatedAt: new Date() },
  })
}

async function obterAtualizado(companyId: string, id: string) {
  return buscarPorId(companyId, id)
}

async function limparPadraoEmpresa(companyId: string, excetoId?: string) {
  return clientePrisma.configuracaoBoleto.updateMany({
    where: {
      companyId,
      ...(excetoId ? { NOT: { id: excetoId } } : {}),
    },
    data: { padrao: false },
  })
}

async function definirPadrao(companyId: string, id: string) {
  return clientePrisma.$transaction(async (tx) => {
    await tx.configuracaoBoleto.updateMany({
      where: { companyId },
      data: { padrao: false },
    })
    await tx.configuracaoBoleto.updateMany({
      where: { id, companyId },
      data: { padrao: true, updatedAt: new Date() },
    })
    return tx.configuracaoBoleto.findFirst({ where: { id, companyId } })
  })
}

async function atualizarTesteConexao(
  companyId: string,
  id: string,
  sucesso: boolean,
  mensagem: string
) {
  return clientePrisma.configuracaoBoleto.updateMany({
    where: { id, companyId },
    data: {
      ultimoTesteEm: new Date(),
      ultimoTesteSucesso: sucesso,
      ultimoTesteMensagem: mensagem,
      updatedAt: new Date(),
    },
  })
}

export const repositorioParametrosBoleto = {
  listar,
  buscarPorId,
  buscarPorNome,
  criar,
  atualizar,
  obterAtualizado,
  limparPadraoEmpresa,
  definirPadrao,
  atualizarTesteConexao,
}
