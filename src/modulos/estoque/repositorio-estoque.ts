/**
 * Persistência do ledger de estoque (EstoqueSaldo + EstoqueMovimento).
 */
import type { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  decimalParaNumero,
  type DimensaoEstoque,
  type SaldosEstoque,
} from './tipos-estoque.js'

type Tx = Prisma.TransactionClient

const selectProdutoKardex = {
  id: true,
  companyId: true,
  sku: true,
  nomeVenda: true,
  nomeCompra: true,
  marca: true,
  unidade: true,
  codigoBarras: true,
  ncm: true,
  codigoOrigem: true,
  multiploVenda: true,
  precoCusto: true,
  controlaEstoque: true,
  permiteEstoqueNegativo: true,
  bloqueadoVenda: true,
  ativo: true,
  fornecedores: {
    orderBy: { ordem: 'asc' as const },
    select: {
      id: true,
      fornecedorPessoaId: true,
      codigoFornecedor: true,
      unidadeEntrada: true,
      multiploEntrada: true,
      multiplicadorEntrada: true,
      ordem: true,
      fornecedor: {
        select: {
          id: true,
          nome: true,
          nomeFantasia: true,
          cnpj: true,
          cpf: true,
          tipo: true,
        },
      },
    },
  },
} satisfies Prisma.ProdutoSelect

function mapearSaldos(row: {
  qtdFisica: Prisma.Decimal
  qtdReservada: Prisma.Decimal
  qtdBloqueada: Prisma.Decimal
  qtdFiscal: Prisma.Decimal
}): SaldosEstoque {
  return {
    qtdFisica: decimalParaNumero(row.qtdFisica),
    qtdReservada: decimalParaNumero(row.qtdReservada),
    qtdBloqueada: decimalParaNumero(row.qtdBloqueada),
    qtdFiscal: decimalParaNumero(row.qtdFiscal),
  }
}

async function buscarProdutoEstoque(companyId: string, produtoId: string) {
  return clientePrisma.produto.findFirst({
    where: { id: produtoId, companyId },
    select: selectProdutoKardex,
  })
}

async function buscarMovimentoPorChave(
  companyId: string,
  chaveIdempotencia: string,
  tx?: Tx
) {
  const db = tx ?? clientePrisma
  return db.estoqueMovimento.findUnique({
    where: {
      companyId_chaveIdempotencia: { companyId, chaveIdempotencia },
    },
  })
}

async function obterOuCriarSaldo(
  companyId: string,
  produtoId: string,
  tx: Tx
) {
  const existente = await tx.estoqueSaldo.findUnique({
    where: { companyId_produtoId: { companyId, produtoId } },
  })
  if (existente) return existente

  return tx.estoqueSaldo.create({
    data: {
      companyId,
      produtoId,
      qtdFisica: 0,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 0,
    },
  })
}

async function atualizarSaldo(
  tx: Tx,
  saldoId: string,
  saldos: SaldosEstoque
) {
  return tx.estoqueSaldo.update({
    where: { id: saldoId },
    data: {
      qtdFisica: saldos.qtdFisica,
      qtdReservada: saldos.qtdReservada,
      qtdBloqueada: saldos.qtdBloqueada,
      qtdFiscal: saldos.qtdFiscal,
    },
  })
}

async function criarMovimento(
  tx: Tx,
  dados: {
    companyId: string
    produtoId: string
    dimensao: DimensaoEstoque
    tipoMovimento: string
    quantidade: number
    saldoDepois: number
    origem: string
    origemId?: string | null
    chaveIdempotencia: string
    observacao?: string | null
    usuarioId?: string | null
    pessoaId?: string | null
    precoCusto?: number | null
  }
) {
  return tx.estoqueMovimento.create({
    data: {
      companyId: dados.companyId,
      produtoId: dados.produtoId,
      dimensao: dados.dimensao,
      tipoMovimento: dados.tipoMovimento,
      quantidade: dados.quantidade,
      saldoDepois: dados.saldoDepois,
      origem: dados.origem,
      origemId: dados.origemId ?? null,
      chaveIdempotencia: dados.chaveIdempotencia,
      observacao: dados.observacao ?? null,
      usuarioId: dados.usuarioId ?? null,
      pessoaId: dados.pessoaId ?? null,
      precoCusto: dados.precoCusto ?? null,
    },
  })
}

async function buscarSaldo(companyId: string, produtoId: string) {
  return clientePrisma.estoqueSaldo.findUnique({
    where: { companyId_produtoId: { companyId, produtoId } },
  })
}

async function listarMovimentosPeriodo(dados: {
  companyId: string
  produtoId: string
  de: Date
  ate: Date
  dimensoes: DimensaoEstoque[]
}) {
  return clientePrisma.estoqueMovimento.findMany({
    where: {
      companyId: dados.companyId,
      produtoId: dados.produtoId,
      dimensao: { in: dados.dimensoes },
      createdAt: { gte: dados.de, lte: dados.ate },
    },
    include: {
      usuario: { select: { id: true, name: true } },
      pessoa: {
        select: {
          id: true,
          nome: true,
          nomeFantasia: true,
          cnpj: true,
          cpf: true,
          tipo: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
}

async function buscarUltimoMovimentoAntes(dados: {
  companyId: string
  produtoId: string
  antesDe: Date
  dimensao: DimensaoEstoque
}) {
  return clientePrisma.estoqueMovimento.findFirst({
    where: {
      companyId: dados.companyId,
      produtoId: dados.produtoId,
      dimensao: dados.dimensao,
      createdAt: { lt: dados.antesDe },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
}

async function listarSaldosComProduto(dados: {
  companyId: string
  q?: string
  limite?: number
}) {
  const limite = Math.min(Math.max(dados.limite ?? 50, 1), 200)
  const busca = dados.q?.trim()

  return clientePrisma.produto.findMany({
    where: {
      companyId: dados.companyId,
      controlaEstoque: true,
      ...(busca
        ? {
            OR: [
              { nomeVenda: { contains: busca, mode: 'insensitive' } },
              { sku: { contains: busca, mode: 'insensitive' } },
              { codigoBarras: { contains: busca, mode: 'insensitive' } },
              { marca: { contains: busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      sku: true,
      nomeVenda: true,
      unidade: true,
      marca: true,
      ativo: true,
      controlaEstoque: true,
      estoqueSaldo: true,
    },
    orderBy: { nomeVenda: 'asc' },
    take: limite,
  })
}

async function garantirSaldoZero(companyId: string, produtoId: string) {
  return clientePrisma.estoqueSaldo.upsert({
    where: { companyId_produtoId: { companyId, produtoId } },
    create: {
      companyId,
      produtoId,
      qtdFisica: 0,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 0,
    },
    update: {},
  })
}

async function fornecedorVinculadoAoProduto(
  produtoId: string,
  fornecedorPessoaId: string,
  companyId: string
) {
  return clientePrisma.produtoFornecedor.findFirst({
    where: {
      produtoId,
      fornecedorPessoaId,
      produto: { companyId },
    },
    select: { id: true },
  })
}

async function existeMovimentoPorOrigem(
  companyId: string,
  origem: string,
  origemId: string
) {
  const row = await clientePrisma.estoqueMovimento.findFirst({
    where: { companyId, origem, origemId },
    select: { id: true },
  })
  return Boolean(row)
}

async function listarMovimentosPorOrigem(
  companyId: string,
  origem: string,
  origemId: string
) {
  return clientePrisma.estoqueMovimento.findMany({
    where: { companyId, origem, origemId },
    include: {
      produto: { select: { id: true, nomeVenda: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
}

export const repositorioDeEstoque = {
  mapearSaldos,
  buscarProdutoEstoque,
  buscarMovimentoPorChave,
  obterOuCriarSaldo,
  atualizarSaldo,
  criarMovimento,
  buscarSaldo,
  listarMovimentosPeriodo,
  buscarUltimoMovimentoAntes,
  listarSaldosComProduto,
  garantirSaldoZero,
  fornecedorVinculadoAoProduto,
  existeMovimentoPorOrigem,
  listarMovimentosPorOrigem,
  clientePrisma,
}
