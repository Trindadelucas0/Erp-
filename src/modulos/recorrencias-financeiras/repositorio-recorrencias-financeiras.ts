import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { montarFiltroBuscaTextual } from '../../compartilhado/utilitarios/filtro-busca-textual.js'

const includeListagem = {
  fornecedorPessoa: { select: { id: true, nome: true, nomeFantasia: true, cnpj: true, cpf: true } },
  produto: { select: { id: true, nomeVenda: true, sku: true, unidade: true } },
} as const

function decimalNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

function mapear(registro: {
  id: string
  companyId: string
  fornecedorPessoaId: string
  produtoId: string
  valor: unknown
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

async function criar(
  companyId: string,
  dados: {
    fornecedorPessoaId: string
    produtoId: string
    valor: number
    ativo: boolean
  }
) {
  const registro = await clientePrisma.recorrenciaFinanceira.create({
    data: {
      companyId,
      fornecedorPessoaId: dados.fornecedorPessoaId,
      produtoId: dados.produtoId,
      valor: new Prisma.Decimal(dados.valor.toFixed(2)),
      ativo: dados.ativo,
    },
    include: includeListagem,
  })
  return mapear(registro)
}

async function atualizar(
  companyId: string,
  id: string,
  dados: {
    fornecedorPessoaId: string
    produtoId: string
    valor: number
    ativo: boolean
  }
) {
  const existe = await clientePrisma.recorrenciaFinanceira.findFirst({
    where: { id, companyId },
    select: { id: true },
  })
  if (!existe) return null

  const registro = await clientePrisma.recorrenciaFinanceira.update({
    where: { id },
    data: {
      fornecedorPessoaId: dados.fornecedorPessoaId,
      produtoId: dados.produtoId,
      valor: new Prisma.Decimal(dados.valor.toFixed(2)),
      ativo: dados.ativo,
    },
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

export const repositorioDeRecorrenciasFinanceiras = {
  listar,
  buscarPorId,
  listarAtivasPorFornecedor,
  buscarAtivaPorFornecedorEValor,
  criar,
  atualizar,
  alterarAtivo,
  mapear,
  valorEmCentavos,
  decimalNum,
}
