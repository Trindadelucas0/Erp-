import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { NivelEstruturaWms } from './esquema-estrutura-wms.js'
import { statusParaAtivo } from './status-efetivo-wms.js'
import {
  PADRAO_AREAS_WMS,
  PADRAO_LOCAIS_WMS,
} from '../enderecos-wms/nomenclatura-endereco-wms.js'

export type NivelEnderecoWmsRegistro = {
  id: string
  nivel: string
  codigo: string
  nome: string
  parentId: string | null
  sequencia: number
  status: string
  ativo: boolean
  createdAt: Date
}

function mapear(row: NivelEnderecoWmsRegistro): NivelEnderecoWmsRegistro {
  return {
    id: row.id,
    nivel: row.nivel,
    codigo: row.codigo,
    nome: row.nome,
    parentId: row.parentId,
    sequencia: row.sequencia,
    status: row.status,
    ativo: row.ativo,
    createdAt: row.createdAt,
  }
}

async function listarPorEmpresa(
  companyId: string,
  opcoes?: { nivel?: NivelEstruturaWms; incluirInativos?: boolean; status?: string }
) {
  const rows = await clientePrisma.nivelEnderecoWms.findMany({
    where: {
      companyId,
      ...(opcoes?.nivel ? { nivel: opcoes.nivel } : {}),
      ...(opcoes?.status && opcoes.status !== 'todos' ? { status: opcoes.status } : {}),
      ...(!opcoes?.incluirInativos && !opcoes?.status ? { ativo: true } : {}),
    },
    orderBy: [{ sequencia: 'asc' }, { codigo: 'asc' }],
  })
  return rows.map(mapear)
}

async function buscarPorId(companyId: string, id: string) {
  const row = await clientePrisma.nivelEnderecoWms.findFirst({
    where: { id, companyId },
  })
  return row ? mapear(row) : null
}

async function buscarFilhoPorCodigo(companyId: string, parentId: string | null, codigo: string) {
  const row = await clientePrisma.nivelEnderecoWms.findFirst({
    where: { companyId, parentId, codigo },
  })
  return row ? mapear(row) : null
}

async function listarFilhos(companyId: string, parentId: string) {
  const rows = await clientePrisma.nivelEnderecoWms.findMany({
    where: { companyId, parentId },
    orderBy: [{ sequencia: 'asc' }, { codigo: 'asc' }],
  })
  return rows.map(mapear)
}

async function contarFilhos(companyId: string, parentId: string) {
  return clientePrisma.nivelEnderecoWms.count({ where: { companyId, parentId } })
}

async function proximaSequencia(companyId: string, parentId: string | null) {
  const agg = await clientePrisma.nivelEnderecoWms.aggregate({
    where: { companyId, parentId },
    _max: { sequencia: true },
  })
  return (agg._max.sequencia ?? -1) + 1
}

async function criar(
  companyId: string,
  dados: {
    nivel: string
    codigo: string
    nome: string
    parentId: string | null
    sequencia: number
    status: string
  }
) {
  const row = await clientePrisma.nivelEnderecoWms.create({
    data: {
      companyId,
      nivel: dados.nivel,
      codigo: dados.codigo,
      nome: dados.nome,
      parentId: dados.parentId,
      sequencia: dados.sequencia,
      status: dados.status,
      ativo: statusParaAtivo(dados.status),
    },
  })
  return mapear(row)
}

async function atualizar(
  companyId: string,
  id: string,
  dados: {
    codigo?: string
    nome?: string
    parentId?: string | null
    sequencia?: number
    status?: string
  }
) {
  const existente = await clientePrisma.nivelEnderecoWms.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existente) return null

  const row = await clientePrisma.nivelEnderecoWms.update({
    where: { id },
    data: {
      ...(dados.codigo != null ? { codigo: dados.codigo } : {}),
      ...(dados.nome != null ? { nome: dados.nome } : {}),
      ...(dados.parentId !== undefined ? { parentId: dados.parentId } : {}),
      ...(dados.sequencia != null ? { sequencia: dados.sequencia } : {}),
      ...(dados.status != null
        ? { status: dados.status, ativo: statusParaAtivo(dados.status) }
        : {}),
    },
  })
  return mapear(row)
}

async function excluir(companyId: string, id: string) {
  const existente = await clientePrisma.nivelEnderecoWms.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existente) return false
  await clientePrisma.nivelEnderecoWms.delete({ where: { id } })
  return true
}

async function garantirCatalogoPadrao(companyId: string) {
  const jaTem = await clientePrisma.nivelEnderecoWms.count({ where: { companyId } })
  if (jaTem > 0) return

  const locais = []
  for (const [i, item] of PADRAO_LOCAIS_WMS.entries()) {
    locais.push(
      await clientePrisma.nivelEnderecoWms.create({
        data: {
          companyId,
          nivel: 'local',
          codigo: item.codigo,
          nome: item.nome,
          parentId: null,
          sequencia: i,
          status: 'ativo',
          ativo: true,
        },
      })
    )
  }
  const localA = locais.find((l) => l.codigo === 'A') ?? locais[0]
  if (!localA) return

  await clientePrisma.nivelEnderecoWms.createMany({
    data: PADRAO_AREAS_WMS.map((item, i) => ({
      companyId,
      nivel: 'area',
      codigo: item.codigo,
      nome: item.nome,
      parentId: localA.id,
      sequencia: i,
      status: 'ativo',
      ativo: true,
    })),
    skipDuplicates: true,
  })
}

async function coletarIdsSubarvore(companyId: string, raizId: string): Promise<string[]> {
  const todos = await listarPorEmpresa(companyId, { incluirInativos: true })
  const ids = new Set<string>([raizId])
  let mudou = true
  while (mudou) {
    mudou = false
    for (const no of todos) {
      if (no.parentId && ids.has(no.parentId) && !ids.has(no.id)) {
        ids.add(no.id)
        mudou = true
      }
    }
  }
  return [...ids]
}

async function ancestrais(companyId: string, id: string): Promise<NivelEnderecoWmsRegistro[]> {
  const cadeia: NivelEnderecoWmsRegistro[] = []
  let atual = await buscarPorId(companyId, id)
  const vistos = new Set<string>()
  while (atual?.parentId && !vistos.has(atual.parentId)) {
    vistos.add(atual.parentId)
    const pai = await buscarPorId(companyId, atual.parentId)
    if (!pai) break
    cadeia.push(pai)
    atual = pai
  }
  return cadeia
}

function ehUnicidadePrisma(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002'
}

export const repositorioDeEstruturaWms = {
  listarPorEmpresa,
  buscarPorId,
  buscarFilhoPorCodigo,
  listarFilhos,
  contarFilhos,
  proximaSequencia,
  criar,
  atualizar,
  excluir,
  garantirCatalogoPadrao,
  garantirAreasETiposPadrao: garantirCatalogoPadrao,
  coletarIdsSubarvore,
  ancestrais,
  ehUnicidadePrisma,
}
