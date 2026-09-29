import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarFiltroBuscaTextual } from '../../compartilhado/utilitarios/filtro-busca-textual.js'

type DadosTipoVeiculo = { nome: string; pesoMaximoKg: number; icone: string | null; ativo: boolean }

function mapear(registro: {
  id: string
  companyId: string
  nome: string
  pesoMaximoKg: number
  icone: string | null
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: registro.id,
    companyId: registro.companyId,
    nome: registro.nome,
    pesoMaximoKg: registro.pesoMaximoKg,
    icone: registro.icone,
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
  if (filtro.somenteAtivos || !filtro.incluirInativos) {
    where.ativo = true
  }

  const registros = await clientePrisma.tipoVeiculo.findMany({
    where,
    orderBy: { nome: 'asc' },
  })
  return registros.map(mapear)
}

async function buscarPorId(companyId: string, id: string) {
  const registro = await clientePrisma.tipoVeiculo.findFirst({
    where: { id, companyId },
  })
  return registro ? mapear(registro) : null
}

async function buscarPorNome(companyId: string, nome: string, excluirId?: string) {
  const registro = await clientePrisma.tipoVeiculo.findFirst({
    where: {
      companyId,
      nome: { equals: nome, mode: 'insensitive' },
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
  })
  return registro ? mapear(registro) : null
}

async function criar(companyId: string, dados: DadosTipoVeiculo) {
  const registro = await clientePrisma.tipoVeiculo.create({
    data: { companyId, ...dados },
  })
  return mapear(registro)
}

async function atualizar(companyId: string, id: string, dados: DadosTipoVeiculo) {
  const existe = await clientePrisma.tipoVeiculo.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.tipoVeiculo.update({
    where: { id },
    data: dados,
  })
  return mapear(registro)
}

async function alterarStatus(companyId: string, id: string, ativo: boolean) {
  const existe = await clientePrisma.tipoVeiculo.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.tipoVeiculo.update({
    where: { id },
    data: { ativo },
  })
  return mapear(registro)
}

export const repositorioDeTiposVeiculo = {
  listar,
  buscarPorId,
  buscarPorNome,
  criar,
  atualizar,
  alterarStatus,
}
