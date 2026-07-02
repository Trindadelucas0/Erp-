import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { DadosParaCriarCfop, DadosParaEditarCfop } from './esquema-cfops.js'
import {
  aproveitarCreditoIcmsPermitido,
  inferirCfopDoCodigo,
  naturezaEhEntradaFornecedor,
  tipoCfopFinal,
} from './classificacao-cfop.js'

export type CfopRegistro = {
  id: string
  codigo: string
  nome: string
  descricao: string
  tipoCfop: string
  natureza: string
  abrangencia: string | null
  subtipoCfop: string | null
  aproveitarCreditoIcms: boolean
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
  natureza: string
  abrangencia: string | null
  subtipoCfop: string | null
  aproveitarCreditoIcms: boolean
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
    natureza: cfop.natureza,
    abrangencia: cfop.abrangencia,
    subtipoCfop: cfop.subtipoCfop,
    aproveitarCreditoIcms: cfop.aproveitarCreditoIcms,
    tipo: cfop.tipo,
    ativo: cfop.ativo,
    createdAt: cfop.createdAt,
  }
}

function dadosClassificados(codigo: string, subtipoCfop?: string | null) {
  const classificacao = inferirCfopDoCodigo(codigo)
  return {
    natureza: classificacao.natureza,
    abrangencia: classificacao.abrangencia,
    tipo: classificacao.tipo,
    tipoCfop: tipoCfopFinal(classificacao, subtipoCfop ?? null),
    subtipoCfop: subtipoCfop ?? null,
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
              natureza: { in: ['entrada', 'importacao'] },
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
  const classificados = dadosClassificados(dados.codigo, dados.subtipoCfop)
  const aproveitarCreditoIcms = aproveitarCreditoIcmsPermitido(
    dados.codigo,
    dados.aproveitarCreditoIcms
  )
  const cfop = await clientePrisma.cfop.create({
    data: {
      companyId,
      codigo: dados.codigo,
      nome: dados.nome,
      descricao: dados.descricao || '',
      ...classificados,
      aproveitarCreditoIcms,
    },
  })
  return mapear(cfop)
}

async function atualizar(
  companyId: string,
  id: string,
  dados: DadosParaEditarCfop,
  codigo: string
) {
  const classificados = dadosClassificados(codigo, dados.subtipoCfop)
  const aproveitarCreditoIcms = aproveitarCreditoIcmsPermitido(
    codigo,
    dados.aproveitarCreditoIcms
  )
  const cfop = await clientePrisma.cfop.update({
    where: { id },
    data: {
      nome: dados.nome,
      descricao: dados.descricao || '',
      ...classificados,
      aproveitarCreditoIcms,
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

async function validarIdsEntradaFornecedor(companyId: string, ids: string[]) {
  if (ids.length === 0) return
  const cfops = await clientePrisma.cfop.findMany({
    where: { id: { in: ids }, companyId, ativo: true },
    select: { id: true, natureza: true },
  })
  if (cfops.length !== ids.length) {
    throw new Error('CFOP não encontrado ou inativo')
  }
  const invalido = cfops.some((c) => !naturezaEhEntradaFornecedor(c.natureza))
  if (invalido) {
    throw new Error('CFOP deve ser de entrada ou importação')
  }
}

export const repositorioDeCfops = {
  listarPorEmpresa,
  buscarPorId,
  buscarPorCodigo,
  criar,
  atualizar,
  alterarAtivo,
  mapear,
  validarIdsEntradaFornecedor,
}
