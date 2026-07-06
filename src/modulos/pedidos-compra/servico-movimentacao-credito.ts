/**
 * Reserva, baixa e estorno de crédito do fornecedor vinculado a pedidos de compra.
 */
import type { Prisma } from '@prisma/client'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

export type TipoMovimentoCredito = 'entrada' | 'reserva' | 'baixa' | 'estorno_reserva'

export function calcularSaldoDisponivel(
  saldoAtual: number,
  reservaAtivaNoPedido?: number | null
): number {
  return Math.round((saldoAtual + (reservaAtivaNoPedido ?? 0)) * 100) / 100
}

function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100
}

async function registrarMovimento(
  tx: Prisma.TransactionClient,
  dados: {
    companyId: string
    creditoFornecedorId: string
    tipo: TipoMovimentoCredito
    valor: number
    saldoAnterior: number
    saldoDepois: number
    motivo?: string | null
    pedidoCompraId?: string | null
  }
) {
  await tx.creditoFornecedorMovimento.create({
    data: {
      companyId: dados.companyId,
      creditoFornecedorId: dados.creditoFornecedorId,
      tipo: dados.tipo,
      valor: dados.valor,
      saldoAnterior: dados.saldoAnterior,
      saldoDepois: dados.saldoDepois,
      motivo: dados.motivo ?? null,
      pedidoCompraId: dados.pedidoCompraId ?? null,
    },
  })
}

export async function registrarEntradaCredito(
  tx: Prisma.TransactionClient,
  dados: {
    companyId: string
    creditoFornecedorId: string
    valor: number
    origem?: string | null
  }
) {
  const valor = arredondarMoeda(dados.valor)
  await registrarMovimento(tx, {
    companyId: dados.companyId,
    creditoFornecedorId: dados.creditoFornecedorId,
    tipo: 'entrada',
    valor,
    saldoAnterior: 0,
    saldoDepois: valor,
    motivo: dados.origem?.trim() || 'Crédito cadastrado',
  })
}

async function estornarReservaInterna(
  tx: Prisma.TransactionClient,
  reserva: {
    id: string
    creditoFornecedorId: string
    pedidoCompraId: string
    valor: Prisma.Decimal
    status: string
  },
  companyId: string,
  pedidoNumero: number,
  motivoExtra?: string
) {
  if (reserva.status !== 'ativa') return

  const credito = await tx.creditoFornecedor.findUnique({
    where: { id: reserva.creditoFornecedorId },
  })
  if (!credito) {
    throw new ErroDaAplicacao('Crédito do fornecedor não encontrado para estorno', 400)
  }

  const valor = arredondarMoeda(Number(reserva.valor))
  const saldoAnterior = arredondarMoeda(Number(credito.saldo))
  const saldoDepois = arredondarMoeda(saldoAnterior + valor)

  await tx.creditoFornecedor.update({
    where: { id: credito.id },
    data: { saldo: saldoDepois },
  })

  await registrarMovimento(tx, {
    companyId,
    creditoFornecedorId: credito.id,
    tipo: 'estorno_reserva',
    valor,
    saldoAnterior,
    saldoDepois,
    motivo: motivoExtra ?? `Estorno de reserva — Pedido #${pedidoNumero}`,
    pedidoCompraId: reserva.pedidoCompraId,
  })

  await tx.creditoReservaPedido.update({
    where: { id: reserva.id },
    data: { status: 'estornada' },
  })
}

export async function estornarReservaPedido(
  tx: Prisma.TransactionClient,
  pedidoCompraId: string,
  companyId: string,
  pedidoNumero: number,
  motivoExtra?: string
) {
  const reserva = await tx.creditoReservaPedido.findUnique({
    where: { pedidoCompraId },
  })
  if (!reserva) return

  await estornarReservaInterna(tx, reserva, companyId, pedidoNumero, motivoExtra)
}

export async function sincronizarReservaCreditoPedido(
  tx: Prisma.TransactionClient,
  dados: {
    companyId: string
    pedidoCompraId: string
    pedidoNumero: number
    creditoFornecedorId?: string | null
    creditoAplicado?: number | null
  }
) {
  const reservaExistente = await tx.creditoReservaPedido.findUnique({
    where: { pedidoCompraId: dados.pedidoCompraId },
  })

  const creditoId = dados.creditoFornecedorId || null
  const valorAplicar =
    dados.creditoAplicado != null && dados.creditoAplicado > 0
      ? arredondarMoeda(dados.creditoAplicado)
      : null

  if (!creditoId || !valorAplicar) {
    if (reservaExistente?.status === 'ativa') {
      await estornarReservaInterna(
        tx,
        reservaExistente,
        dados.companyId,
        dados.pedidoNumero,
        'Crédito removido do pedido'
      )
    }
    return
  }

  if (
    reservaExistente?.status === 'ativa' &&
    reservaExistente.creditoFornecedorId === creditoId &&
    arredondarMoeda(Number(reservaExistente.valor)) === valorAplicar
  ) {
    return
  }

  if (reservaExistente?.status === 'ativa') {
    await estornarReservaInterna(
      tx,
      reservaExistente,
      dados.companyId,
      dados.pedidoNumero,
      'Alteração de crédito no pedido'
    )
  }

  const credito = await tx.creditoFornecedor.findFirst({
    where: {
      id: creditoId,
      companyId: dados.companyId,
    },
  })
  if (!credito) {
    throw new ErroDaAplicacao('Crédito do fornecedor inválido', 400)
  }

  const saldoAtual = arredondarMoeda(Number(credito.saldo))
  if (valorAplicar > saldoAtual) {
    throw new ErroDaAplicacao('Crédito aplicado excede o saldo disponível', 400)
  }

  const saldoDepois = arredondarMoeda(saldoAtual - valorAplicar)

  await tx.creditoFornecedor.update({
    where: { id: credito.id },
    data: { saldo: saldoDepois },
  })

  await registrarMovimento(tx, {
    companyId: dados.companyId,
    creditoFornecedorId: credito.id,
    tipo: 'reserva',
    valor: valorAplicar,
    saldoAnterior: saldoAtual,
    saldoDepois,
    motivo: `Reserva — Pedido #${dados.pedidoNumero}`,
    pedidoCompraId: dados.pedidoCompraId,
  })

  if (reservaExistente) {
    await tx.creditoReservaPedido.update({
      where: { id: reservaExistente.id },
      data: {
        creditoFornecedorId: creditoId,
        valor: valorAplicar,
        status: 'ativa',
      },
    })
  } else {
    await tx.creditoReservaPedido.create({
      data: {
        creditoFornecedorId: creditoId,
        pedidoCompraId: dados.pedidoCompraId,
        valor: valorAplicar,
        status: 'ativa',
      },
    })
  }
}

export async function baixarReservaPedido(
  tx: Prisma.TransactionClient,
  pedidoCompraId: string,
  companyId: string,
  motivo = 'Baixa na entrada da nota fiscal'
) {
  const reserva = await tx.creditoReservaPedido.findUnique({
    where: { pedidoCompraId },
  })
  if (!reserva || reserva.status !== 'ativa') {
    return false
  }

  const credito = await tx.creditoFornecedor.findUnique({
    where: { id: reserva.creditoFornecedorId },
  })
  if (!credito) {
    throw new ErroDaAplicacao('Crédito do fornecedor não encontrado para baixa', 400)
  }

  const valor = arredondarMoeda(Number(reserva.valor))
  const saldoAtual = arredondarMoeda(Number(credito.saldo))

  await registrarMovimento(tx, {
    companyId,
    creditoFornecedorId: credito.id,
    tipo: 'baixa',
    valor,
    saldoAnterior: saldoAtual,
    saldoDepois: saldoAtual,
    motivo,
    pedidoCompraId,
  })

  await tx.creditoReservaPedido.update({
    where: { id: reserva.id },
    data: { status: 'baixada' },
  })

  return true
}

export async function obterReservaAtivaPedido(
  tx: Prisma.TransactionClient,
  pedidoCompraId: string
) {
  return tx.creditoReservaPedido.findUnique({
    where: { pedidoCompraId },
  })
}

export const servicoMovimentacaoCredito = {
  calcularSaldoDisponivel,
  registrarEntradaCredito,
  sincronizarReservaCreditoPedido,
  estornarReservaPedido,
  baixarReservaPedido,
  obterReservaAtivaPedido,
}
