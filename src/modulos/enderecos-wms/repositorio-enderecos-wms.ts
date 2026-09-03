import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarFiltroBuscaTextual } from '../../compartilhado/utilitarios/filtro-busca-textual.js'
import { extrasBuscaEnderecoWms } from './nomenclatura-endereco-wms.js'
import type { ComponentesEnderecoWmsValidos } from './nomenclatura-endereco-wms.js'

export type EnderecoWmsRegistro = {
  id: string
  codigo: string
  local: string
  area: string
  tipo: string
  rua: string
  andar: string
  posicao: string
  ativo: boolean
  createdAt: Date
}

function mapear(row: EnderecoWmsRegistro): EnderecoWmsRegistro {
  return {
    id: row.id,
    codigo: row.codigo,
    local: row.local,
    area: row.area,
    tipo: row.tipo,
    rua: row.rua,
    andar: row.andar,
    posicao: row.posicao,
    ativo: row.ativo,
    createdAt: row.createdAt,
  }
}

function filtroBusca(q?: string) {
  return montarFiltroBuscaTextual(q, (token) => {
    const extras = extrasBuscaEnderecoWms(token)
    const or: Prisma.EnderecoWmsWhereInput[] = [
      { codigo: { contains: token, mode: 'insensitive' } },
      { local: { contains: token, mode: 'insensitive' } },
      { area: { contains: token, mode: 'insensitive' } },
      { tipo: { contains: token, mode: 'insensitive' } },
      { rua: { contains: token, mode: 'insensitive' } },
      { andar: { contains: token, mode: 'insensitive' } },
      { posicao: { contains: token, mode: 'insensitive' } },
    ]
    for (const local of extras.locais) or.push({ local })
    for (const area of extras.areas) or.push({ area })
    for (const tipo of extras.tipos) or.push({ tipo })
    return { OR: or }
  })
}

async function listarPorEmpresa(
  companyId: string,
  opcoes?: {
    incluirInativos?: boolean
    q?: string
    local?: string
    area?: string
    tipo?: string
  }
) {
  const busca = filtroBusca(opcoes?.q)
  const rows = await clientePrisma.enderecoWms.findMany({
    where: {
      companyId,
      ...(!opcoes?.incluirInativos ? { ativo: true } : {}),
      ...(opcoes?.local ? { local: opcoes.local } : {}),
      ...(opcoes?.area ? { area: opcoes.area } : {}),
      ...(opcoes?.tipo ? { tipo: opcoes.tipo } : {}),
      ...(busca ?? {}),
    },
    orderBy: { codigo: 'asc' },
  })
  return rows.map(mapear)
}

async function buscarPorId(companyId: string, id: string) {
  const row = await clientePrisma.enderecoWms.findFirst({
    where: { id, companyId },
  })
  return row ? mapear(row) : null
}

async function buscarPorCodigo(companyId: string, codigo: string, excluirId?: string) {
  const row = await clientePrisma.enderecoWms.findFirst({
    where: {
      companyId,
      codigo,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
  })
  return row ? mapear(row) : null
}

async function criar(
  companyId: string,
  dados: ComponentesEnderecoWmsValidos & { codigo: string; ativo: boolean }
) {
  const row = await clientePrisma.enderecoWms.create({
    data: {
      companyId,
      codigo: dados.codigo,
      local: dados.local,
      area: dados.area,
      tipo: dados.tipo,
      rua: dados.rua,
      andar: dados.andar,
      posicao: dados.posicao,
      ativo: dados.ativo,
    },
  })
  return mapear(row)
}

async function atualizar(
  companyId: string,
  id: string,
  dados: ComponentesEnderecoWmsValidos & { codigo: string; ativo: boolean }
) {
  const existente = await clientePrisma.enderecoWms.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existente) return null

  const row = await clientePrisma.enderecoWms.update({
    where: { id },
    data: {
      codigo: dados.codigo,
      local: dados.local,
      area: dados.area,
      tipo: dados.tipo,
      rua: dados.rua,
      andar: dados.andar,
      posicao: dados.posicao,
      ativo: dados.ativo,
    },
  })
  return mapear(row)
}

export const repositorioDeEnderecosWms = {
  listarPorEmpresa,
  buscarPorId,
  buscarPorCodigo,
  criar,
  atualizar,
}
