import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { DadosParaCriarCfop, DadosParaEditarCfop } from './esquema-cfops.js'
import { tipoLegadoDeCfop } from './esquema-cfops.js'

export type CfopRegistro = {
  id: string
  codigo: string
  nome: string
  descricao: string
  tipoCfop: string
  tipo: string
  ativo: boolean
  createdAt: Date
}

function mapear(cfop: {
  id: string
  codigo: string
  nome: string
  descricao: string
  tipoCfop: string
  tipo: string
  ativo: boolean
  createdAt: Date
}): CfopRegistro {
  return {
    id: cfop.id,
    codigo: cfop.codigo,
    nome: cfop.nome,
    descricao: cfop.descricao,
    tipoCfop: cfop.tipoCfop,
    tipo: cfop.tipo,
    ativo: cfop.ativo,
    createdAt: cfop.createdAt,
  }
}

async function listarPorEmpresa(
  companyId: string,
  opcoes?: { incluirInativos?: boolean; q?: string; tipo?: string }
) {
  const termo = opcoes?.q?.trim()
  return clientePrisma.cfop.findMany({
    where: {
      companyId,
      ...(!opcoes?.incluirInativos ? { ativo: true } : {}),
      ...(opcoes?.tipo && opcoes.tipo !== 'todos'
        ? opcoes.tipo === 'entrada'
          ? {
              OR: [
                { tipo: 'entrada' },
                { tipoCfop: { in: ['01', '02', '03', '04', '06'] } },
              ],
            }
          : { tipo: opcoes.tipo }
        : {}),
      ...(termo
        ? {
            OR: [
              { codigo: { contains: termo, mode: 'insensitive' } },
              { nome: { contains: termo, mode: 'insensitive' } },
              { descricao: { contains: termo, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { codigo: 'asc' },
    ...(!opcoes?.incluirInativos ? { take: 50 } : {}),
  })
}

async function buscarPorId(companyId: string, id: string) {
  return clientePrisma.cfop.findFirst({ where: { id, companyId } })
}

async function buscarPorCodigo(companyId: string, codigo: string) {
  return clientePrisma.cfop.findFirst({ where: { companyId, codigo } })
}

async function criar(companyId: string, dados: DadosParaCriarCfop) {
  const cfop = await clientePrisma.cfop.create({
    data: {
      companyId,
      codigo: dados.codigo,
      nome: dados.nome,
      descricao: dados.descricao || '',
      tipoCfop: dados.tipoCfop,
      tipo: tipoLegadoDeCfop(dados.tipoCfop),
    },
  })
  return mapear(cfop)
}

async function atualizar(companyId: string, id: string, dados: DadosParaEditarCfop) {
  const cfop = await clientePrisma.cfop.update({
    where: { id },
    data: {
      nome: dados.nome,
      descricao: dados.descricao || '',
      tipoCfop: dados.tipoCfop,
      tipo: tipoLegadoDeCfop(dados.tipoCfop),
    },
  })
  if (cfop.companyId !== companyId) throw new Error('CFOP não pertence à empresa')
  return mapear(cfop)
}

async function alterarAtivo(companyId: string, id: string, ativo: boolean) {
  const existente = await buscarPorId(companyId, id)
  if (!existente) return null
  const cfop = await clientePrisma.cfop.update({ where: { id }, data: { ativo } })
  return mapear(cfop)
}

export const repositorioDeCfops = {
  listarPorEmpresa,
  buscarPorId,
  buscarPorCodigo,
  criar,
  atualizar,
  alterarAtivo,
  mapear,
}
