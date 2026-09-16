import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarFiltroBuscaTextual } from '../../compartilhado/utilitarios/filtro-busca-textual.js'
import { extrasBuscaEnderecoWms } from './nomenclatura-endereco-wms.js'
import { statusParaAtivo } from '../estrutura-wms/status-efetivo-wms.js'

export type EnderecoWmsRegistro = {
  id: string
  andarId: string
  codigo: string
  codigoCompleto: string
  local: string
  area: string
  rua: string
  bloco: string
  andar: string
  posicao: string
  tipoEndereco: string
  sequencia: number
  status: string
  ativo: boolean
  createdAt: Date
}

function mapear(row: EnderecoWmsRegistro): EnderecoWmsRegistro {
  return { ...row }
}

function filtroBusca(q?: string) {
  return montarFiltroBuscaTextual(q, (token) => {
    const extras = extrasBuscaEnderecoWms(token)
    const or: Prisma.EnderecoWmsWhereInput[] = [
      { codigoCompleto: { contains: token, mode: 'insensitive' } },
      { codigo: { contains: token, mode: 'insensitive' } },
      { local: { contains: token, mode: 'insensitive' } },
      { area: { contains: token, mode: 'insensitive' } },
      { rua: { contains: token, mode: 'insensitive' } },
      { bloco: { contains: token, mode: 'insensitive' } },
      { andar: { contains: token, mode: 'insensitive' } },
      { posicao: { contains: token, mode: 'insensitive' } },
      { tipoEndereco: { contains: token, mode: 'insensitive' } },
    ]
    for (const local of extras.locais) or.push({ local })
    for (const area of extras.areas) or.push({ area })
    for (const tipo of extras.tipos) or.push({ tipoEndereco: tipo })
    return { OR: or }
  })
}

async function listarPorEmpresa(
  companyId: string,
  opcoes?: {
    incluirInativos?: boolean
    q?: string
    andarId?: string
    status?: string
    take?: number
  }
) {
  const busca = filtroBusca(opcoes?.q)
  const rows = await clientePrisma.enderecoWms.findMany({
    where: {
      companyId,
      ...(opcoes?.andarId ? { andarId: opcoes.andarId } : {}),
      ...(opcoes?.status && opcoes.status !== 'todos' ? { status: opcoes.status } : {}),
      ...(!opcoes?.incluirInativos && !opcoes?.status && !opcoes?.andarId ? { ativo: true } : {}),
      ...(opcoes?.andarId && !opcoes?.incluirInativos && !opcoes?.status ? {} : {}),
      ...(busca ?? {}),
    },
    orderBy: [{ sequencia: 'asc' }, { codigo: 'asc' }],
    ...(opcoes?.take ? { take: opcoes.take } : {}),
  })
  return rows.map(mapear)
}

async function listarPorAndar(companyId: string, andarId: string, incluirInativos = true) {
  return listarPorEmpresa(companyId, { andarId, incluirInativos: incluirInativos ? true : undefined })
}

async function buscarPorId(companyId: string, id: string) {
  const row = await clientePrisma.enderecoWms.findFirst({
    where: { id, companyId },
  })
  return row ? mapear(row) : null
}

async function buscarPorCodigoCompleto(companyId: string, codigoCompleto: string, excluirId?: string) {
  const row = await clientePrisma.enderecoWms.findFirst({
    where: {
      companyId,
      codigoCompleto,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
  })
  return row ? mapear(row) : null
}

async function buscarPorAndarCodigo(companyId: string, andarId: string, codigo: string, excluirId?: string) {
  const row = await clientePrisma.enderecoWms.findFirst({
    where: {
      companyId,
      andarId,
      codigo,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
  })
  return row ? mapear(row) : null
}

async function proximaSequencia(companyId: string, andarId: string) {
  const agg = await clientePrisma.enderecoWms.aggregate({
    where: { companyId, andarId },
    _max: { sequencia: true },
  })
  return (agg._max.sequencia ?? -1) + 1
}

async function criar(
  companyId: string,
  dados: Omit<EnderecoWmsRegistro, 'id' | 'createdAt'>
) {
  const row = await clientePrisma.enderecoWms.create({
    data: {
      companyId,
      andarId: dados.andarId,
      codigo: dados.codigo,
      codigoCompleto: dados.codigoCompleto,
      local: dados.local,
      area: dados.area,
      rua: dados.rua,
      bloco: dados.bloco,
      andar: dados.andar,
      posicao: dados.posicao,
      tipoEndereco: dados.tipoEndereco,
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
  dados: Partial<Omit<EnderecoWmsRegistro, 'id' | 'createdAt' | 'andarId'>>
) {
  const existente = await clientePrisma.enderecoWms.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existente) return null

  const row = await clientePrisma.enderecoWms.update({
    where: { id },
    data: {
      ...dados,
      ...(dados.status != null ? { ativo: statusParaAtivo(dados.status) } : {}),
    },
  })
  return mapear(row)
}

async function atualizarCodigoCompletoEmLote(
  itens: { id: string; codigoCompleto: string; local: string; area: string; rua: string; bloco: string; andar: string }[]
) {
  await clientePrisma.$transaction(
    itens.map((item) =>
      clientePrisma.enderecoWms.update({
        where: { id: item.id },
        data: {
          codigoCompleto: item.codigoCompleto,
          local: item.local,
          area: item.area,
          rua: item.rua,
          bloco: item.bloco,
          andar: item.andar,
        },
      })
    )
  )
}

async function excluir(companyId: string, id: string) {
  const existente = await clientePrisma.enderecoWms.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existente) return false
  await clientePrisma.enderecoWms.delete({ where: { id } })
  return true
}

async function contarPorAndar(companyId: string, andarId: string) {
  return clientePrisma.enderecoWms.count({ where: { companyId, andarId } })
}

async function contarPorAndares(companyId: string, andarIds: string[]) {
  if (andarIds.length === 0) return new Map<string, number>()
  const grupos = await clientePrisma.enderecoWms.groupBy({
    by: ['andarId'],
    where: { companyId, andarId: { in: andarIds } },
    _count: { _all: true },
  })
  return new Map(grupos.map((g) => [g.andarId, g._count._all]))
}

async function listarPorAndares(companyId: string, andarIds: string[]) {
  if (andarIds.length === 0) return []
  const rows = await clientePrisma.enderecoWms.findMany({
    where: { companyId, andarId: { in: andarIds } },
  })
  return rows.map(mapear)
}

function ehUnicidadePrisma(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002'
}

export const repositorioDeEnderecosWms = {
  listarPorEmpresa,
  listarPorAndar,
  buscarPorId,
  buscarPorCodigoCompleto,
  buscarPorCodigo: buscarPorCodigoCompleto,
  buscarPorAndarCodigo,
  proximaSequencia,
  criar,
  atualizar,
  atualizarCodigoCompletoEmLote,
  excluir,
  contarPorAndar,
  contarPorAndares,
  listarPorAndares,
  ehUnicidadePrisma,
}
