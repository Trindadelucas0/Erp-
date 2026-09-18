import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarFiltroBuscaTextual } from '../../compartilhado/utilitarios/filtro-busca-textual.js'
import { STATUS_FILA_OPERADOR_EXCLUIDOS } from './tipos-requisicao-wms.js'

const includeDetalhe = {
  origemEndereco: { select: { id: true, codigoCompleto: true, ativo: true, status: true } },
  destinoEndereco: { select: { id: true, codigoCompleto: true, ativo: true, status: true } },
  produto: {
    select: {
      id: true,
      nomeVenda: true,
      sku: true,
      codigoBarras: true,
      controlaEstoque: true,
      permiteEstoqueNegativo: true,
      unidade: true,
      embalagensMaster: { select: { codigoBarras: true } },
    },
  },
  responsavel: { select: { id: true, name: true } },
  nfeRecebida: { select: { id: true, chaveNfe: true } },
} satisfies Prisma.RequisicaoWmsInclude

const includeFicha = {
  ...includeDetalhe,
  eventos: {
    orderBy: { createdAt: 'asc' as const },
    include: { usuario: { select: { id: true, name: true } } },
  },
}

export type FiltroRepoListagem = {
  q?: string
  status?: string
  tipo?: string
  prioridade?: number
  fila?: 'minha' | 'todas'
  usuarioId: string
  pagina: number
  limite: number
}

function filtroBusca(q?: string): Prisma.RequisicaoWmsWhereInput | undefined {
  const termo = q?.trim()
  if (!termo) return undefined
  const soDigitos = /^\d+$/.test(termo)
  const textual = montarFiltroBuscaTextual(termo, (token) => ({
    OR: [
      { observacao: { contains: token, mode: 'insensitive' as const } },
      { produto: { nomeVenda: { contains: token, mode: 'insensitive' as const } } },
      { produto: { sku: { contains: token, mode: 'insensitive' as const } } },
      { origemEndereco: { codigoCompleto: { contains: token, mode: 'insensitive' as const } } },
      { destinoEndereco: { codigoCompleto: { contains: token, mode: 'insensitive' as const } } },
      { responsavel: { name: { contains: token, mode: 'insensitive' as const } } },
    ],
  }))
  if (soDigitos) {
    return {
      OR: [{ numero: Number(termo) }, ...(textual ? [textual] : [])],
    }
  }
  return textual
}

function whereListagem(
  companyId: string,
  filtro: FiltroRepoListagem,
  ignorarStatus?: boolean
): Prisma.RequisicaoWmsWhereInput {
  const busca = filtroBusca(filtro.q)
  const filaMinha: Prisma.RequisicaoWmsWhereInput | undefined =
    filtro.fila === 'minha'
      ? {
          AND: [
            { status: { notIn: [...STATUS_FILA_OPERADOR_EXCLUIDOS] } },
            {
              OR: [
                { responsavelId: filtro.usuarioId },
                { status: 'disponivel', responsavelId: null },
              ],
            },
          ],
        }
      : undefined

  return {
    companyId,
    ...(filtro.status && !ignorarStatus ? { status: filtro.status } : {}),
    ...(filtro.tipo ? { tipoOperacao: filtro.tipo } : {}),
    ...(filtro.prioridade ? { prioridade: filtro.prioridade } : {}),
    ...(filaMinha ?? {}),
    ...(busca ?? {}),
  }
}

async function proximoNumero(companyId: string, tx: Prisma.TransactionClient) {
  const ultimo = await tx.requisicaoWms.findFirst({
    where: { companyId },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  return (ultimo?.numero ?? 0) + 1
}

async function criar(
  companyId: string,
  dados: {
    tipoOperacao: string
    prioridade: number
    status: string
    origemEnderecoId: string | null
    destinoEnderecoId: string | null
    produtoId: string | null
    quantidade: number | null
    responsavelId: string | null
    observacao: string | null
    nfeRecebidaId?: string | null
    evento: {
      usuarioId: string
      acao: string
      deStatus: string | null
      paraStatus: string
    }
  }
) {
  return clientePrisma.$transaction(async (tx) => {
    const numero = await proximoNumero(companyId, tx)
    return tx.requisicaoWms.create({
      data: {
        companyId,
        numero,
        tipoOperacao: dados.tipoOperacao,
        prioridade: dados.prioridade,
        status: dados.status,
        origemEnderecoId: dados.origemEnderecoId,
        destinoEnderecoId: dados.destinoEnderecoId,
        produtoId: dados.produtoId,
        quantidade: dados.quantidade,
        responsavelId: dados.responsavelId,
        observacao: dados.observacao,
        nfeRecebidaId: dados.nfeRecebidaId ?? null,
        eventos: {
          create: {
            usuarioId: dados.evento.usuarioId,
            acao: dados.evento.acao,
            deStatus: dados.evento.deStatus,
            paraStatus: dados.evento.paraStatus,
          },
        },
      },
      include: includeFicha,
    })
  })
}

async function listar(companyId: string, filtro: FiltroRepoListagem) {
  const where = whereListagem(companyId, filtro)
  const whereResumo = whereListagem(companyId, filtro, true)
  const skip = (filtro.pagina - 1) * filtro.limite
  const [itens, total, grupos] = await Promise.all([
    clientePrisma.requisicaoWms.findMany({
      where,
      include: includeDetalhe,
      orderBy: [{ prioridade: 'asc' }, { createdAt: 'asc' }],
      skip,
      take: filtro.limite,
    }),
    clientePrisma.requisicaoWms.count({ where }),
    clientePrisma.requisicaoWms.groupBy({
      by: ['status'],
      where: whereResumo,
      _count: { _all: true },
    }),
  ])
  const resumoPorStatus: Record<string, number> = {}
  let totalResumo = 0
  for (const g of grupos) {
    resumoPorStatus[g.status] = g._count._all
    totalResumo += g._count._all
  }
  return { itens, total, resumoPorStatus: { ...resumoPorStatus, _total: totalResumo } }
}

async function buscarPorId(companyId: string, id: string) {
  return clientePrisma.requisicaoWms.findFirst({
    where: { id, companyId },
    include: includeFicha,
  })
}

type EventoAtualizacao = {
  usuarioId: string
  acao: string
  deStatus: string | null
  paraStatus: string
  motivo?: string | null
}

async function atualizarNoTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  id: string,
  data: Prisma.RequisicaoWmsUncheckedUpdateInput,
  evento?: EventoAtualizacao
) {
  await tx.requisicaoWms.update({
    where: { id },
    data,
  })
  if (evento) {
    await tx.requisicaoWmsEvento.create({
      data: {
        requisicaoId: id,
        usuarioId: evento.usuarioId,
        acao: evento.acao,
        deStatus: evento.deStatus,
        paraStatus: evento.paraStatus,
        motivo: evento.motivo ?? null,
      },
    })
  }
  return tx.requisicaoWms.findFirstOrThrow({
    where: { id, companyId },
    include: includeFicha,
  })
}

async function atualizar(
  companyId: string,
  id: string,
  data: Prisma.RequisicaoWmsUncheckedUpdateInput,
  evento?: EventoAtualizacao
) {
  return clientePrisma.$transaction(async (tx) => {
    return atualizarNoTx(tx, companyId, id, data, evento)
  })
}

async function executarEmTransacao<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return clientePrisma.$transaction(fn)
}

async function enderecoDaEmpresa(companyId: string, id: string) {
  return clientePrisma.enderecoWms.findFirst({
    where: { id, companyId },
    select: { id: true, codigoCompleto: true, ativo: true, status: true },
  })
}

async function produtoDaEmpresa(companyId: string, id: string) {
  return clientePrisma.produto.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      sku: true,
      codigoBarras: true,
      controlaEstoque: true,
      permiteEstoqueNegativo: true,
      embalagensMaster: { select: { codigoBarras: true } },
    },
  })
}

async function usuarioDaEmpresa(companyId: string, id: string) {
  return clientePrisma.user.findFirst({
    where: {
      id,
      active: true,
      companies: { some: { companyId } },
    },
    select: { id: true, name: true },
  })
}

async function listarOperadores(companyId: string) {
  return clientePrisma.user.findMany({
    where: {
      active: true,
      companies: { some: { companyId } },
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

async function buscarPorNfeRecebida(
  companyId: string,
  nfeRecebidaId: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? clientePrisma
  return db.requisicaoWms.findFirst({
    where: { companyId, nfeRecebidaId, tipoOperacao: 'contagem_entrada' },
    include: includeFicha,
    orderBy: { createdAt: 'asc' },
  })
}

async function listarPorNfeRecebidaIds(companyId: string, nfeRecebidaIds: string[]) {
  if (nfeRecebidaIds.length === 0) return []
  return clientePrisma.requisicaoWms.findMany({
    where: {
      companyId,
      nfeRecebidaId: { in: nfeRecebidaIds },
      tipoOperacao: 'contagem_entrada',
    },
    include: includeDetalhe,
    orderBy: { createdAt: 'asc' },
  })
}

export const repositorioDeRequisicoesWms = {
  criar,
  listar,
  buscarPorId,
  atualizar,
  atualizarNoTx,
  executarEmTransacao,
  enderecoDaEmpresa,
  produtoDaEmpresa,
  usuarioDaEmpresa,
  listarOperadores,
  buscarPorNfeRecebida,
  listarPorNfeRecebidaIds,
  proximoNumero,
}
