/**
 * CRUD de créditos e pendências de fornecedor.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  calcularSaldoDisponivel,
  registrarEntradaCredito,
} from './servico-movimentacao-credito.js'
import type { DadosCriarCredito, DadosCriarPendencia } from './esquema-creditos-pendencias.js'

async function validarFornecedor(fornecedorPessoaId: string, companyId: string) {
  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      id: fornecedorPessoaId,
      companyId,
      papeis: { some: { papel: 'fornecedor', ativo: true } },
    },
  })
  if (!pessoa) {
    throw new ErroDaAplicacao('Fornecedor inválido ou inativo', 400)
  }
}

async function listarCreditos(
  companyId: string,
  fornecedorPessoaId?: string,
  opcoes?: { comMovimentos?: boolean; apenasComSaldo?: boolean }
) {
  const apenasComSaldo = opcoes?.apenasComSaldo ?? !opcoes?.comMovimentos

  const creditos = await clientePrisma.creditoFornecedor.findMany({
    where: {
      companyId,
      ...(fornecedorPessoaId ? { fornecedorPessoaId } : {}),
      ...(apenasComSaldo ? { saldo: { gt: 0 } } : {}),
    },
    orderBy: { vencimento: 'asc' },
    include: opcoes?.comMovimentos
      ? {
          movimentos: {
            orderBy: { createdAt: 'desc' },
            include: {
              pedidoCompra: { select: { numero: true } },
            },
          },
        }
      : undefined,
  })

  return creditos.map((c) => ({
    id: c.id,
    fornecedorPessoaId: c.fornecedorPessoaId,
    valor: Number(c.valor),
    saldo: Number(c.saldo),
    origem: c.origem,
    vencimento: c.vencimento,
    movimentos: opcoes?.comMovimentos
      ? ('movimentos' in c
          ? c.movimentos.map((m) => ({
              id: m.id,
              tipo: m.tipo,
              valor: Number(m.valor),
              saldoAnterior: Number(m.saldoAnterior),
              saldoDepois: Number(m.saldoDepois),
              motivo: m.motivo,
              pedidoCompraId: m.pedidoCompraId,
              pedidoNumero: m.pedidoCompra?.numero ?? null,
              createdAt: m.createdAt,
            }))
          : [])
      : undefined,
  }))
}

async function criarCredito(dados: DadosCriarCredito, companyId: string) {
  await validarFornecedor(dados.fornecedorPessoaId, companyId)
  const saldo = dados.saldo ?? dados.valor

  const credito = await clientePrisma.$transaction(async (tx) => {
    const criado = await tx.creditoFornecedor.create({
      data: {
        companyId,
        fornecedorPessoaId: dados.fornecedorPessoaId,
        valor: dados.valor,
        saldo,
        origem: dados.origem || null,
        vencimento: dados.vencimento ? new Date(dados.vencimento) : null,
      },
    })

    await registrarEntradaCredito(tx, {
      companyId,
      creditoFornecedorId: criado.id,
      valor: Number(criado.valor),
      origem: criado.origem,
    })

    return criado
  })

  return {
    id: credito.id,
    fornecedorPessoaId: credito.fornecedorPessoaId,
    valor: Number(credito.valor),
    saldo: Number(credito.saldo),
    origem: credito.origem,
    vencimento: credito.vencimento,
  }
}

async function listarPendencias(companyId: string, fornecedorPessoaId?: string, apenasAbertas = true) {
  const pendencias = await clientePrisma.pendenciaFornecedor.findMany({
    where: {
      companyId,
      ...(fornecedorPessoaId ? { fornecedorPessoaId } : {}),
      ...(apenasAbertas ? { resolvido: false } : {}),
    },
    include: { produto: { select: { id: true, nomeVenda: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return pendencias.map((p) => ({
    id: p.id,
    fornecedorPessoaId: p.fornecedorPessoaId,
    tipo: p.tipo,
    descricao: p.descricao,
    produtoId: p.produtoId,
    produtoNome: p.produto?.nomeVenda ?? null,
    resolvido: p.resolvido,
    createdAt: p.createdAt,
  }))
}

async function criarPendencia(dados: DadosCriarPendencia, companyId: string) {
  await validarFornecedor(dados.fornecedorPessoaId, companyId)
  if (dados.produtoId) {
    const produto = await clientePrisma.produto.findFirst({
      where: { id: dados.produtoId, companyId },
    })
    if (!produto) {
      throw new ErroDaAplicacao('Produto inválido', 400)
    }
  }
  const pendencia = await clientePrisma.pendenciaFornecedor.create({
    data: {
      companyId,
      fornecedorPessoaId: dados.fornecedorPessoaId,
      tipo: dados.tipo,
      descricao: dados.descricao,
      produtoId: dados.produtoId || null,
    },
    include: { produto: { select: { id: true, nomeVenda: true } } },
  })
  return {
    id: pendencia.id,
    fornecedorPessoaId: pendencia.fornecedorPessoaId,
    tipo: pendencia.tipo,
    descricao: pendencia.descricao,
    produtoId: pendencia.produtoId,
    produtoNome: pendencia.produto?.nomeVenda ?? null,
    resolvido: pendencia.resolvido,
  }
}

async function resolverPendencia(id: string, resolvido: boolean, companyId: string) {
  const existente = await clientePrisma.pendenciaFornecedor.findFirst({
    where: { id, companyId },
  })
  if (!existente) {
    throw new ErroDaAplicacao('Pendência não encontrada', 404)
  }
  const atualizada = await clientePrisma.pendenciaFornecedor.update({
    where: { id },
    data: { resolvido },
    include: { produto: { select: { id: true, nomeVenda: true } } },
  })
  return {
    id: atualizada.id,
    resolvido: atualizada.resolvido,
  }
}

async function validarCreditoNoPedido(
  creditoFornecedorId: string | null | undefined,
  creditoAplicado: number | null | undefined,
  fornecedorPessoaId: string,
  companyId: string,
  pedidoCompraId?: string
) {
  if (!creditoFornecedorId && !creditoAplicado) return

  if (creditoFornecedorId) {
    const credito = await clientePrisma.creditoFornecedor.findFirst({
      where: { id: creditoFornecedorId, companyId, fornecedorPessoaId },
    })
    if (!credito) {
      throw new ErroDaAplicacao('Crédito do fornecedor inválido', 400)
    }

    let reservaNoPedido = 0
    if (pedidoCompraId) {
      const reserva = await clientePrisma.creditoReservaPedido.findUnique({
        where: { pedidoCompraId },
      })
      if (
        reserva?.status === 'ativa' &&
        reserva.creditoFornecedorId === creditoFornecedorId
      ) {
        reservaNoPedido = Number(reserva.valor)
      }
    }

    const valorAplicar = creditoAplicado ?? Number(credito.saldo)
    const disponivel = calcularSaldoDisponivel(Number(credito.saldo), reservaNoPedido)
    if (valorAplicar > disponivel) {
      throw new ErroDaAplicacao('Crédito aplicado excede o saldo disponível', 400)
    }
    return { creditoFornecedorId, creditoAplicado: valorAplicar }
  }

  if (creditoAplicado && creditoAplicado > 0) {
    throw new ErroDaAplicacao('Selecione o crédito do fornecedor para aplicar valor', 400)
  }
}

export const servicoCreditosPendencias = {
  listarCreditos,
  criarCredito,
  listarPendencias,
  criarPendencia,
  resolverPendencia,
  validarCreditoNoPedido,
}
