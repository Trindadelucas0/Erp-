import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarFiltroBuscaTextual } from '../../compartilhado/utilitarios/filtro-busca-textual.js'
import {
  competenciaDeData,
  filtrarRecorrenciasDaAgenda,
  intervaloBuscaDaCompetencia,
} from './vigencia-recorrencia.js'

const includeListagem = {
  fornecedorPessoa: { select: { id: true, nome: true, nomeFantasia: true, cnpj: true, cpf: true } },
  produto: { select: { id: true, nomeVenda: true, sku: true, unidade: true } },
} as const

function decimalNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

type DadosPersistenciaRecorrencia = {
  fornecedorPessoaId: string
  produtoId: string
  valor: number
  periodicidade: string
  diaVencimento: number
  competenciaInicio: string
  competenciaFim: string | null
  ativo: boolean
}

function mapear(registro: {
  id: string
  companyId: string
  fornecedorPessoaId: string
  produtoId: string
  valor: unknown
  periodicidade: string
  diaVencimento: number
  competenciaInicio: string
  competenciaFim: string | null
  ativo: boolean
  createdAt: Date
  updatedAt: Date
  fornecedorPessoa?: {
    id: string
    nome: string
    nomeFantasia: string | null
    cnpj: string | null
    cpf: string | null
  }
  produto?: {
    id: string
    nomeVenda: string
    sku: string | null
    unidade: string
  }
}) {
  return {
    id: registro.id,
    companyId: registro.companyId,
    fornecedorPessoaId: registro.fornecedorPessoaId,
    produtoId: registro.produtoId,
    valor: decimalNum(registro.valor),
    periodicidade: registro.periodicidade,
    diaVencimento: registro.diaVencimento,
    competenciaInicio: registro.competenciaInicio,
    competenciaFim: registro.competenciaFim,
    ativo: registro.ativo,
    createdAt: registro.createdAt.toISOString(),
    updatedAt: registro.updatedAt.toISOString(),
    fornecedor: registro.fornecedorPessoa
      ? {
          id: registro.fornecedorPessoa.id,
          nome: registro.fornecedorPessoa.nome,
          nomeFantasia: registro.fornecedorPessoa.nomeFantasia,
          documento: registro.fornecedorPessoa.cnpj ?? registro.fornecedorPessoa.cpf,
        }
      : null,
    produto: registro.produto
      ? {
          id: registro.produto.id,
          nomeVenda: registro.produto.nomeVenda,
          sku: registro.produto.sku,
          unidade: registro.produto.unidade,
        }
      : null,
  }
}

async function listar(
  companyId: string,
  filtro: { q?: string; incluirInativos?: boolean; fornecedorPessoaId?: string }
) {
  const filtroBusca = montarFiltroBuscaTextual(filtro.q, (token) => ({
    OR: [
      { fornecedorPessoa: { nome: { contains: token, mode: 'insensitive' as const } } },
      { fornecedorPessoa: { nomeFantasia: { contains: token, mode: 'insensitive' as const } } },
      { produto: { nomeVenda: { contains: token, mode: 'insensitive' as const } } },
      { produto: { sku: { contains: token, mode: 'insensitive' as const } } },
    ],
  }))

  const registros = await clientePrisma.recorrenciaFinanceira.findMany({
    where: {
      companyId,
      ...(filtro.incluirInativos ? {} : { ativo: true }),
      ...(filtro.fornecedorPessoaId ? { fornecedorPessoaId: filtro.fornecedorPessoaId } : {}),
      ...(filtroBusca ?? {}),
    },
    include: includeListagem,
    orderBy: [{ ativo: 'desc' }, { createdAt: 'desc' }],
  })

  return registros.map(mapear)
}

async function buscarPorId(companyId: string, id: string) {
  const registro = await clientePrisma.recorrenciaFinanceira.findFirst({
    where: { id, companyId },
    include: includeListagem,
  })
  return registro ? mapear(registro) : null
}

async function listarAtivasPorFornecedor(companyId: string, fornecedorPessoaId: string) {
  const registros = await clientePrisma.recorrenciaFinanceira.findMany({
    where: { companyId, fornecedorPessoaId, ativo: true },
    include: includeListagem,
    orderBy: { valor: 'asc' },
  })
  return registros.map(mapear)
}

async function listarAtivas(companyId: string) {
  const registros = await clientePrisma.recorrenciaFinanceira.findMany({
    where: { companyId, ativo: true },
    include: includeListagem,
    orderBy: [{ diaVencimento: 'asc' }, { createdAt: 'asc' }],
  })
  return registros.map(mapear)
}

/** Compara valor em centavos (evita float). */
function valorEmCentavos(valor: number): number {
  return Math.round(valor * 100)
}

async function buscarAtivaPorFornecedorEValor(
  companyId: string,
  fornecedorPessoaId: string,
  valor: number,
  excluirId?: string
) {
  const centavos = valorEmCentavos(valor)
  const candidatos = await clientePrisma.recorrenciaFinanceira.findMany({
    where: {
      companyId,
      fornecedorPessoaId,
      ativo: true,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: { id: true, valor: true },
  })
  return (
    candidatos.find((c) => valorEmCentavos(decimalNum(c.valor)) === centavos) ?? null
  )
}

function dadosPrisma(dados: DadosPersistenciaRecorrencia) {
  return {
    fornecedorPessoaId: dados.fornecedorPessoaId,
    produtoId: dados.produtoId,
    valor: new Prisma.Decimal(dados.valor.toFixed(2)),
    periodicidade: dados.periodicidade,
    diaVencimento: dados.diaVencimento,
    competenciaInicio: dados.competenciaInicio,
    competenciaFim: dados.competenciaFim,
    ativo: dados.ativo,
  }
}

async function criar(companyId: string, dados: DadosPersistenciaRecorrencia) {
  const registro = await clientePrisma.recorrenciaFinanceira.create({
    data: {
      companyId,
      ...dadosPrisma(dados),
    },
    include: includeListagem,
  })
  return mapear(registro)
}

async function atualizar(companyId: string, id: string, dados: DadosPersistenciaRecorrencia) {
  const existe = await clientePrisma.recorrenciaFinanceira.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.recorrenciaFinanceira.update({
    where: { id },
    data: dadosPrisma(dados),
    include: includeListagem,
  })
  return mapear(registro)
}

async function alterarAtivo(companyId: string, id: string, ativo: boolean) {
  const existe = await clientePrisma.recorrenciaFinanceira.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.recorrenciaFinanceira.update({
    where: { id },
    data: { ativo },
    include: includeListagem,
  })
  return mapear(registro)
}

async function idsComNotaNaCompetencia(
  companyId: string,
  recorrenciaIds: string[],
  competencia: string
): Promise<Set<string>> {
  if (recorrenciaIds.length === 0) return new Set()
  const janela = intervaloBuscaDaCompetencia(competencia)
  const notas = await clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      recorrenciaFinanceiraId: { in: recorrenciaIds },
      dataEmissao: { gte: janela.gte, lt: janela.lt },
    },
    select: { recorrenciaFinanceiraId: true, dataEmissao: true },
  })
  const ids = new Set<string>()
  for (const nota of notas) {
    if (!nota.recorrenciaFinanceiraId || !nota.dataEmissao) continue
    if (competenciaDeData(nota.dataEmissao) !== competencia) continue
    ids.add(nota.recorrenciaFinanceiraId)
  }
  return ids
}

async function montarAgenda(companyId: string, competencia: string) {
  const ativas = await listarAtivas(companyId)
  const naCompetencia = filtrarRecorrenciasDaAgenda(ativas, competencia)
  const chegaram = await idsComNotaNaCompetencia(
    companyId,
    naCompetencia.map((r) => r.id),
    competencia
  )

  const itens = naCompetencia.map((r) => ({
    recorrenciaId: r.id,
    fornecedorNome: r.fornecedor?.nomeFantasia || r.fornecedor?.nome || '—',
    servicoNome: r.produto?.nomeVenda || '—',
    valor: r.valor,
    diaVencimento: r.diaVencimento,
    situacao: chegaram.has(r.id) ? ('chegou' as const) : ('aguardando' as const),
  }))

  const totalEsperado = itens.reduce((acc, i) => acc + i.valor, 0)
  const quantidadeChegou = itens.filter((i) => i.situacao === 'chegou').length

  return {
    competencia,
    itens,
    totalEsperado,
    quantidadeRegras: itens.length,
    quantidadeChegou,
  }
}

export const repositorioDeRecorrenciasFinanceiras = {
  listar,
  buscarPorId,
  listarAtivasPorFornecedor,
  listarAtivas,
  buscarAtivaPorFornecedorEValor,
  criar,
  atualizar,
  alterarAtivo,
  montarAgenda,
  mapear,
  valorEmCentavos,
  decimalNum,
}
