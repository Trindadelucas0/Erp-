import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { NivelEstruturaWms } from './esquema-estrutura-wms.js'
import { PADRAO_AREAS_WMS, PADRAO_TIPOS_WMS } from '../enderecos-wms/nomenclatura-endereco-wms.js'

export type NivelEnderecoWmsRegistro = {
  id: string
  nivel: string
  codigo: string
  nome: string
  paiCodigo: string | null
  ativo: boolean
  createdAt: Date
}

function mapear(row: {
  id: string
  nivel: string
  codigo: string
  nome: string
  paiCodigo: string | null
  ativo: boolean
  createdAt: Date
}): NivelEnderecoWmsRegistro {
  return {
    id: row.id,
    nivel: row.nivel,
    codigo: row.codigo,
    nome: row.nome,
    paiCodigo: row.paiCodigo,
    ativo: row.ativo,
    createdAt: row.createdAt,
  }
}

async function listarPorEmpresa(
  companyId: string,
  opcoes?: { nivel?: NivelEstruturaWms; incluirInativos?: boolean }
) {
  const rows = await clientePrisma.nivelEnderecoWms.findMany({
    where: {
      companyId,
      ...(opcoes?.nivel ? { nivel: opcoes.nivel } : {}),
      ...(!opcoes?.incluirInativos ? { ativo: true } : {}),
    },
    orderBy: [{ nivel: 'asc' }, { codigo: 'asc' }],
  })
  return rows.map(mapear)
}

async function buscarPorId(companyId: string, id: string) {
  const row = await clientePrisma.nivelEnderecoWms.findFirst({
    where: { id, companyId },
  })
  return row ? mapear(row) : null
}

async function buscarPorNivelCodigo(
  companyId: string,
  nivel: string,
  codigo: string
) {
  const row = await clientePrisma.nivelEnderecoWms.findFirst({
    where: { companyId, nivel, codigo },
  })
  return row ? mapear(row) : null
}

async function criar(
  companyId: string,
  dados: {
    nivel: string
    codigo: string
    nome: string
    paiCodigo: string | null
    ativo: boolean
  }
) {
  const row = await clientePrisma.nivelEnderecoWms.create({
    data: {
      companyId,
      nivel: dados.nivel,
      codigo: dados.codigo,
      nome: dados.nome,
      paiCodigo: dados.paiCodigo,
      ativo: dados.ativo,
    },
  })
  return mapear(row)
}

async function atualizar(
  companyId: string,
  id: string,
  dados: { codigo: string; nome: string; paiCodigo: string | null; ativo: boolean }
) {
  const existente = await clientePrisma.nivelEnderecoWms.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existente) return null

  const row = await clientePrisma.nivelEnderecoWms.update({
    where: { id },
    data: {
      codigo: dados.codigo,
      nome: dados.nome,
      paiCodigo: dados.paiCodigo,
      ativo: dados.ativo,
    },
  })
  return mapear(row)
}

async function garantirAreasETiposPadrao(companyId: string) {
  const padrao = [
    ...PADRAO_AREAS_WMS.map((item) => ({
      companyId,
      nivel: 'area',
      codigo: item.codigo,
      nome: item.nome,
      ativo: true,
    })),
    ...PADRAO_TIPOS_WMS.map((item) => ({
      companyId,
      nivel: 'tipo',
      codigo: item.codigo,
      nome: item.nome,
      ativo: true,
    })),
  ]

  await clientePrisma.nivelEnderecoWms.createMany({
    data: padrao,
    skipDuplicates: true,
  })
}

function ehUnicidadePrisma(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002'
}

export const repositorioDeEstruturaWms = {
  listarPorEmpresa,
  buscarPorId,
  buscarPorNivelCodigo,
  criar,
  atualizar,
  garantirAreasETiposPadrao,
  ehUnicidadePrisma,
}
