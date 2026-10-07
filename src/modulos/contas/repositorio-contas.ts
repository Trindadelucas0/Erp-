import type { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarFiltroBuscaTextual } from '../../compartilhado/utilitarios/filtro-busca-textual.js'

function decimalParaNumero(valor: Prisma.Decimal | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null
  return Number(valor)
}

function mapear(registro: {
  id: string
  companyId: string
  nome: string
  tipo: string
  banco: string | null
  agencia: string | null
  digitoAgencia: string | null
  conta: string | null
  digitoConta: string | null
  limiteChequeEspecial: Prisma.Decimal | null
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: registro.id,
    companyId: registro.companyId,
    nome: registro.nome,
    tipo: registro.tipo,
    banco: registro.banco,
    agencia: registro.agencia,
    digitoAgencia: registro.digitoAgencia,
    conta: registro.conta,
    digitoConta: registro.digitoConta,
    limiteChequeEspecial: decimalParaNumero(registro.limiteChequeEspecial),
    ativo: registro.ativo,
    createdAt: registro.createdAt.toISOString(),
    updatedAt: registro.updatedAt.toISOString(),
  }
}

async function listar(
  companyId: string,
  filtro: { q?: string; incluirInativos?: boolean; somenteAtivos?: boolean }
) {
  const filtroBusca = montarFiltroBuscaTextual(filtro.q, (token) => ({
    OR: [
      { nome: { contains: token, mode: 'insensitive' as const } },
      { banco: { contains: token, mode: 'insensitive' as const } },
      { agencia: { contains: token, mode: 'insensitive' as const } },
      { conta: { contains: token, mode: 'insensitive' as const } },
    ],
  }))

  const where: Record<string, unknown> = {
    companyId,
    ...(filtroBusca ?? {}),
  }

  if (filtro.somenteAtivos) {
    where.ativo = true
  } else if (!filtro.incluirInativos) {
    where.ativo = true
  }

  const registros = await clientePrisma.contaEmpresa.findMany({
    where,
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
  })
  return registros.map(mapear)
}

async function buscarPorId(companyId: string, id: string) {
  const registro = await clientePrisma.contaEmpresa.findFirst({
    where: { id, companyId },
  })
  return registro ? mapear(registro) : null
}

async function buscarPorNome(companyId: string, nome: string, excluirId?: string) {
  const registro = await clientePrisma.contaEmpresa.findFirst({
    where: {
      companyId,
      nome: { equals: nome, mode: 'insensitive' },
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
  })
  return registro ? mapear(registro) : null
}

async function buscarBancariaDuplicada(
  companyId: string,
  banco: string,
  agencia: string,
  conta: string,
  excluirId?: string
) {
  const registro = await clientePrisma.contaEmpresa.findFirst({
    where: {
      companyId,
      tipo: 'bancaria',
      banco,
      agencia,
      conta,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
  })
  return registro ? mapear(registro) : null
}

async function buscarAtivaPorId(companyId: string, id: string) {
  const registro = await clientePrisma.contaEmpresa.findFirst({
    where: { id, companyId, ativo: true },
    select: { id: true, nome: true },
  })
  return registro
}

async function criar(
  companyId: string,
  dados: {
    nome: string
    tipo: string
    banco: string | null
    agencia: string | null
    digitoAgencia: string | null
    conta: string | null
    digitoConta: string | null
    limiteChequeEspecial: number | null
    ativo: boolean
  }
) {
  const registro = await clientePrisma.contaEmpresa.create({
    data: {
      companyId,
      nome: dados.nome,
      tipo: dados.tipo,
      banco: dados.banco,
      agencia: dados.agencia,
      digitoAgencia: dados.digitoAgencia,
      conta: dados.conta,
      digitoConta: dados.digitoConta,
      limiteChequeEspecial: dados.limiteChequeEspecial,
      ativo: dados.ativo,
    },
  })
  return mapear(registro)
}

async function atualizar(
  companyId: string,
  id: string,
  dados: {
    nome: string
    tipo: string
    banco: string | null
    agencia: string | null
    digitoAgencia: string | null
    conta: string | null
    digitoConta: string | null
    limiteChequeEspecial: number | null
    ativo: boolean
  }
) {
  const existe = await clientePrisma.contaEmpresa.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.contaEmpresa.update({
    where: { id },
    data: {
      nome: dados.nome,
      tipo: dados.tipo,
      banco: dados.banco,
      agencia: dados.agencia,
      digitoAgencia: dados.digitoAgencia,
      conta: dados.conta,
      digitoConta: dados.digitoConta,
      limiteChequeEspecial: dados.limiteChequeEspecial,
      ativo: dados.ativo,
    },
  })
  return mapear(registro)
}

async function alterarStatus(companyId: string, id: string, ativo: boolean) {
  const existe = await clientePrisma.contaEmpresa.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.contaEmpresa.update({
    where: { id },
    data: { ativo },
  })
  return mapear(registro)
}

export const repositorioDeContas = {
  listar,
  buscarPorId,
  buscarPorNome,
  buscarBancariaDuplicada,
  buscarAtivaPorId,
  criar,
  atualizar,
  alterarStatus,
}
