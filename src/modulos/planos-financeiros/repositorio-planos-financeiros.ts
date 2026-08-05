import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type {
  DadosParaCriarPlanoFinanceiro,
  DadosParaEditarPlanoFinanceiro,
} from './esquema-planos-financeiros.js'
import type { TipoPlanoFinanceiro } from './codigo-plano-financeiro.js'
import { montarFiltroBuscaCamposEscalares } from '../../compartilhado/utilitarios/filtro-busca-textual.js'

export type PlanoFinanceiroRegistro = {
  id: string
  codigo: string
  nome: string
  tipo: string
  classificacao: string | null
  mostrarNaDre: boolean
  permiteLancamentoManual: boolean
  exigeAnexoLancamento: boolean
  permiteUsoConsumo: boolean
  parentId: string | null
  ativo: boolean
  createdAt: Date
}

function mapear(plano: {
  id: string
  codigo: string
  nome: string
  tipo: string
  classificacao: string | null
  mostrarNaDre: boolean
  permiteLancamentoManual: boolean
  exigeAnexoLancamento: boolean
  permiteUsoConsumo: boolean
  parentId: string | null
  ativo: boolean
  createdAt: Date
}): PlanoFinanceiroRegistro {
  return {
    id: plano.id,
    codigo: plano.codigo,
    nome: plano.nome,
    tipo: plano.tipo,
    classificacao: plano.classificacao,
    mostrarNaDre: plano.mostrarNaDre,
    permiteLancamentoManual: plano.permiteLancamentoManual,
    exigeAnexoLancamento: plano.exigeAnexoLancamento,
    permiteUsoConsumo: plano.permiteUsoConsumo,
    parentId: plano.parentId,
    ativo: plano.ativo,
    createdAt: plano.createdAt,
  }
}

async function listarPorEmpresa(
  companyId: string,
  opcoes?: { tipo?: TipoPlanoFinanceiro; incluirInativos?: boolean; q?: string }
) {
  const filtroBusca = montarFiltroBuscaCamposEscalares(opcoes?.q, ['codigo', 'nome'])
  return clientePrisma.planoFinanceiro.findMany({
    where: {
      companyId,
      ...(opcoes?.tipo ? { tipo: opcoes.tipo } : {}),
      ...(!opcoes?.incluirInativos ? { ativo: true } : {}),
      ...(filtroBusca ?? {}),
    },
    orderBy: { codigo: 'asc' },
    ...(opcoes?.q && !opcoes?.incluirInativos ? { take: 50 } : {}),
  })
}

async function listarFolhasAtivas(
  companyId: string,
  q?: string,
  tipo?: TipoPlanoFinanceiro,
  somenteSubgrupo?: boolean
) {
  const filtroBusca = montarFiltroBuscaCamposEscalares(q, ['codigo', 'nome'])
  const planos = await clientePrisma.planoFinanceiro.findMany({
    where: {
      companyId,
      ativo: true,
      ...(tipo ? { tipo } : {}),
      ...(somenteSubgrupo ? { parentId: { not: null } } : {}),
      ...(filtroBusca ?? {}),
    },
    include: { _count: { select: { children: true } } },
    orderBy: { codigo: 'asc' },
    take: 50,
  })

  return planos.filter((p) => p._count.children === 0)
}

async function buscarPorId(companyId: string, id: string) {
  return clientePrisma.planoFinanceiro.findFirst({
    where: { id, companyId },
  })
}

async function buscarPorCodigo(companyId: string, codigo: string) {
  return clientePrisma.planoFinanceiro.findFirst({
    where: { companyId, codigo },
  })
}

async function listarCodigosPorEmpresa(companyId: string, tipo?: TipoPlanoFinanceiro) {
  const planos = await clientePrisma.planoFinanceiro.findMany({
    where: { companyId, ...(tipo ? { tipo } : {}) },
    select: { codigo: true },
  })
  return planos.map((p) => p.codigo)
}

async function listarFilhosDiretos(companyId: string, parentId: string) {
  return clientePrisma.planoFinanceiro.findMany({
    where: { companyId, parentId },
    select: { codigo: true },
  })
}

async function contarFilhosAtivos(companyId: string, parentId: string) {
  return clientePrisma.planoFinanceiro.count({
    where: { companyId, parentId, ativo: true },
  })
}

async function criar(
  companyId: string,
  dados: DadosParaCriarPlanoFinanceiro & { codigo: string }
) {
  const plano = await clientePrisma.planoFinanceiro.create({
    data: {
      companyId,
      codigo: dados.codigo,
      nome: dados.nome,
      tipo: dados.tipo,
      classificacao: dados.classificacao || null,
      parentId: dados.parentId ?? null,
      mostrarNaDre: dados.mostrarNaDre ?? true,
      permiteLancamentoManual: dados.permiteLancamentoManual ?? false,
      exigeAnexoLancamento: dados.exigeAnexoLancamento ?? false,
      permiteUsoConsumo: dados.permiteUsoConsumo ?? false,
    },
  })
  return mapear(plano)
}

async function atualizar(
  companyId: string,
  id: string,
  dados: DadosParaEditarPlanoFinanceiro
) {
  const plano = await clientePrisma.planoFinanceiro.update({
    where: { id },
    data: {
      nome: dados.nome,
      classificacao: dados.classificacao || null,
      mostrarNaDre: dados.mostrarNaDre,
      permiteLancamentoManual: dados.permiteLancamentoManual,
      exigeAnexoLancamento: dados.exigeAnexoLancamento,
      permiteUsoConsumo: dados.permiteUsoConsumo,
    },
  })

  if (plano.companyId !== companyId) {
    throw new Error('Plano não pertence à empresa')
  }

  return mapear(plano)
}

async function alterarAtivo(companyId: string, id: string, ativo: boolean) {
  const existente = await buscarPorId(companyId, id)
  if (!existente) return null

  const plano = await clientePrisma.planoFinanceiro.update({
    where: { id },
    data: { ativo },
  })
  return mapear(plano)
}

async function listarPorEmpresaParaMover(companyId: string, tipo: TipoPlanoFinanceiro) {
  return clientePrisma.planoFinanceiro.findMany({
    where: { companyId, tipo },
    orderBy: { codigo: 'asc' },
  })
}

function codigoTemporarioRenumeracao(id: string): string {
  return `__renum__${id}`
}

async function atualizarPosicaoEmLote(
  updates: { id: string; codigo: string; parentId?: string | null }[]
) {
  if (updates.length === 0) return

  // Duas fases evitam violar @@unique([codigo, companyId]) ao renumerar em lote.
  await clientePrisma.$transaction([
    ...updates.map((u) =>
      clientePrisma.planoFinanceiro.update({
        where: { id: u.id },
        data: { codigo: codigoTemporarioRenumeracao(u.id) },
      })
    ),
    ...updates.map((u) =>
      clientePrisma.planoFinanceiro.update({
        where: { id: u.id },
        data: {
          codigo: u.codigo,
          ...(u.parentId !== undefined ? { parentId: u.parentId } : {}),
        },
      })
    ),
  ])
}

export const repositorioDePlanosFinanceiros = {
  listarPorEmpresa,
  listarFolhasAtivas,
  buscarPorId,
  buscarPorCodigo,
  listarCodigosPorEmpresa,
  listarFilhosDiretos,
  contarFilhosAtivos,
  criar,
  atualizar,
  alterarAtivo,
  listarPorEmpresaParaMover,
  atualizarPosicaoEmLote,
  mapear,
}
