import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarFiltroBuscaTextual } from '../../compartilhado/utilitarios/filtro-busca-textual.js'

function mapear(registro: {
  id: string
  companyId: string
  nome: string
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: registro.id,
    companyId: registro.companyId,
    nome: registro.nome,
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
    nome: { contains: token, mode: 'insensitive' as const },
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

  const registros = await clientePrisma.adquirente.findMany({
    where,
    orderBy: { nome: 'asc' },
  })
  return registros.map(mapear)
}

async function buscarPorId(companyId: string, id: string) {
  const registro = await clientePrisma.adquirente.findFirst({
    where: { id, companyId },
  })
  return registro ? mapear(registro) : null
}

async function buscarPorNome(companyId: string, nome: string, excluirId?: string) {
  const registro = await clientePrisma.adquirente.findFirst({
    where: {
      companyId,
      nome: { equals: nome, mode: 'insensitive' },
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
  })
  return registro ? mapear(registro) : null
}

async function criar(companyId: string, dados: { nome: string; ativo: boolean }) {
  const registro = await clientePrisma.adquirente.create({
    data: {
      companyId,
      nome: dados.nome,
      ativo: dados.ativo,
    },
  })
  return mapear(registro)
}

async function atualizar(
  companyId: string,
  id: string,
  dados: { nome: string; ativo: boolean }
) {
  const existe = await clientePrisma.adquirente.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.adquirente.update({
    where: { id },
    data: {
      nome: dados.nome,
      ativo: dados.ativo,
    },
  })
  return mapear(registro)
}

async function alterarStatus(companyId: string, id: string, ativo: boolean) {
  const existe = await clientePrisma.adquirente.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.adquirente.update({
    where: { id },
    data: { ativo },
  })
  return mapear(registro)
}

export const repositorioDeAdquirentes = {
  listar,
  buscarPorId,
  buscarPorNome,
  criar,
  atualizar,
  alterarStatus,
}
