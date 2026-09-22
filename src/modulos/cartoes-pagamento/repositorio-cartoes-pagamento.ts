import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarFiltroBuscaTextual } from '../../compartilhado/utilitarios/filtro-busca-textual.js'
import type { DadosTaxaCartao } from './esquema-cartoes-pagamento.js'

function decimalNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

const includeCartao = {
  adquirente: { select: { id: true, nome: true, ativo: true } },
  taxas: { orderBy: { numeroParcelas: 'asc' as const } },
} as const

type RegistroTaxa = {
  id: string
  numeroParcelas: number
  taxaPercentual: unknown
  prazoDias: number
  valorFixo: unknown
}

type RegistroCartao = {
  id: string
  companyId: string
  adquirenteId: string
  bandeira: string
  tipo: string
  nomeExibicao: string
  ativo: boolean
  permitirParcelamento: boolean
  createdAt: Date
  updatedAt: Date
  adquirente?: { id: string; nome: string; ativo: boolean }
  taxas?: RegistroTaxa[]
}

function mapearTaxa(t: RegistroTaxa) {
  return {
    id: t.id,
    numeroParcelas: t.numeroParcelas,
    taxaPercentual: decimalNum(t.taxaPercentual),
    prazoDias: t.prazoDias,
    valorFixo: decimalNum(t.valorFixo),
  }
}

function mapear(registro: RegistroCartao) {
  return {
    id: registro.id,
    companyId: registro.companyId,
    adquirenteId: registro.adquirenteId,
    bandeira: registro.bandeira,
    tipo: registro.tipo,
    nomeExibicao: registro.nomeExibicao,
    ativo: registro.ativo,
    permitirParcelamento: registro.permitirParcelamento,
    createdAt: registro.createdAt.toISOString(),
    updatedAt: registro.updatedAt.toISOString(),
    adquirente: registro.adquirente
      ? {
          id: registro.adquirente.id,
          nome: registro.adquirente.nome,
          ativo: registro.adquirente.ativo,
        }
      : null,
    taxas: (registro.taxas ?? []).map(mapearTaxa),
  }
}

export type DadosPersistenciaCartao = {
  adquirenteId: string
  bandeira: string
  tipo: string
  nomeExibicao: string
  ativo: boolean
  permitirParcelamento: boolean
  taxas: DadosTaxaCartao[]
}

async function listar(
  companyId: string,
  filtro: {
    q?: string
    incluirInativos?: boolean
    adquirenteId?: string
    bandeira?: string
    tipo?: string
  }
) {
  const filtroBusca = montarFiltroBuscaTextual(filtro.q, (token) => ({
    OR: [
      { nomeExibicao: { contains: token, mode: 'insensitive' as const } },
      { bandeira: { contains: token, mode: 'insensitive' as const } },
      { adquirente: { nome: { contains: token, mode: 'insensitive' as const } } },
    ],
  }))

  const registros = await clientePrisma.cartaoPagamento.findMany({
    where: {
      companyId,
      ...(filtro.incluirInativos ? {} : { ativo: true }),
      ...(filtro.adquirenteId ? { adquirenteId: filtro.adquirenteId } : {}),
      ...(filtro.bandeira ? { bandeira: filtro.bandeira } : {}),
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtroBusca ?? {}),
    },
    include: includeCartao,
    orderBy: [{ nomeExibicao: 'asc' }],
  })
  return registros.map(mapear)
}

async function buscarPorId(companyId: string, id: string) {
  const registro = await clientePrisma.cartaoPagamento.findFirst({
    where: { id, companyId },
    include: includeCartao,
  })
  return registro ? mapear(registro) : null
}

async function buscarDuplicata(
  companyId: string,
  adquirenteId: string,
  bandeira: string,
  tipo: string,
  excluirId?: string
) {
  const registro = await clientePrisma.cartaoPagamento.findFirst({
    where: {
      companyId,
      adquirenteId,
      bandeira,
      tipo,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: { id: true },
  })
  return registro
}

async function criar(companyId: string, dados: DadosPersistenciaCartao) {
  const registro = await clientePrisma.cartaoPagamento.create({
    data: {
      companyId,
      adquirenteId: dados.adquirenteId,
      bandeira: dados.bandeira,
      tipo: dados.tipo,
      nomeExibicao: dados.nomeExibicao,
      ativo: dados.ativo,
      permitirParcelamento: dados.permitirParcelamento,
      taxas: {
        create: dados.taxas.map((t) => ({
          numeroParcelas: t.numeroParcelas,
          taxaPercentual: t.taxaPercentual,
          prazoDias: t.prazoDias,
          valorFixo: t.valorFixo,
        })),
      },
    },
    include: includeCartao,
  })
  return mapear(registro)
}

async function atualizar(companyId: string, id: string, dados: DadosPersistenciaCartao) {
  const existe = await clientePrisma.cartaoPagamento.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.$transaction(async (tx) => {
    await tx.cartaoPagamentoTaxa.deleteMany({ where: { cartaoPagamentoId: id } })
    return tx.cartaoPagamento.update({
      where: { id },
      data: {
        adquirenteId: dados.adquirenteId,
        bandeira: dados.bandeira,
        tipo: dados.tipo,
        nomeExibicao: dados.nomeExibicao,
        ativo: dados.ativo,
        permitirParcelamento: dados.permitirParcelamento,
        taxas: {
          create: dados.taxas.map((t) => ({
            numeroParcelas: t.numeroParcelas,
            taxaPercentual: t.taxaPercentual,
            prazoDias: t.prazoDias,
            valorFixo: t.valorFixo,
          })),
        },
      },
      include: includeCartao,
    })
  })

  return mapear(registro)
}

async function alterarStatus(companyId: string, id: string, ativo: boolean) {
  const existe = await clientePrisma.cartaoPagamento.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.cartaoPagamento.update({
    where: { id },
    data: { ativo },
    include: includeCartao,
  })
  return mapear(registro)
}

export const repositorioDeCartoesPagamento = {
  listar,
  buscarPorId,
  buscarDuplicata,
  criar,
  atualizar,
  alterarStatus,
}
