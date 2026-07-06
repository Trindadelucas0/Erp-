import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  baixarReservaPedido,
  calcularSaldoDisponivel,
  estornarReservaPedido,
  sincronizarReservaCreditoPedido,
} from './servico-movimentacao-credito.js'

function criarTxMock() {
  const credito = {
    id: 'cred-1',
    companyId: 'comp-1',
    saldo: 500,
  }

  const reservas = new Map<string, {
    id: string
    creditoFornecedorId: string
    pedidoCompraId: string
    valor: number
    status: string
  }>()

  const movimentos: unknown[] = []

  const tx = {
    creditoFornecedor: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === credito.id ? { ...credito, saldo: credito.saldo } : null
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === credito.id ? { ...credito, saldo: credito.saldo } : null
      ),
      update: vi.fn(async ({ data }: { data: { saldo: number } }) => {
        credito.saldo = data.saldo
        return { ...credito }
      }),
    },
    creditoReservaPedido: {
      findUnique: vi.fn(async ({ where }: { where: { pedidoCompraId: string } }) => {
        const r = reservas.get(where.pedidoCompraId)
        return r ? { ...r, valor: r.valor } : null
      }),
      create: vi.fn(async ({ data }: { data: { pedidoCompraId: string; creditoFornecedorId: string; valor: number; status: string } }) => {
        const id = `res-${data.pedidoCompraId}`
        const reserva = { id, ...data }
        reservas.set(data.pedidoCompraId, reserva)
        return reserva
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<{ valor: number; status: string; creditoFornecedorId: string }> }) => {
        for (const [key, reserva] of reservas.entries()) {
          if (reserva.id === where.id) {
            const atualizada = { ...reserva, ...data }
            reservas.set(key, atualizada as typeof reserva)
            return atualizada
          }
        }
        return null
      }),
    },
    creditoFornecedorMovimento: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        movimentos.push(data)
        return data
      }),
    },
    _credito: credito,
    _reservas: reservas,
    _movimentos: movimentos,
  }

  return tx
}

describe('calcularSaldoDisponivel', () => {
  it('soma reserva ativa do pedido ao saldo para edição', () => {
    expect(calcularSaldoDisponivel(300, 100)).toBe(400)
  })
})

describe('sincronizarReservaCreditoPedido', () => {
  let tx: ReturnType<typeof criarTxMock>

  beforeEach(() => {
    tx = criarTxMock()
  })

  it('reserva valor e reduz saldo', async () => {
    await sincronizarReservaCreditoPedido(tx as never, {
      companyId: 'comp-1',
      pedidoCompraId: 'po-1',
      pedidoNumero: 10,
      creditoFornecedorId: 'cred-1',
      creditoAplicado: 100,
    })

    expect(tx._credito.saldo).toBe(400)
    expect(tx._reservas.get('po-1')?.status).toBe('ativa')
    expect(tx._movimentos.some((m) => (m as { tipo: string }).tipo === 'reserva')).toBe(true)
  })

  it('ajusta reserva ao editar valor do pedido', async () => {
    await sincronizarReservaCreditoPedido(tx as never, {
      companyId: 'comp-1',
      pedidoCompraId: 'po-1',
      pedidoNumero: 10,
      creditoFornecedorId: 'cred-1',
      creditoAplicado: 100,
    })

    await sincronizarReservaCreditoPedido(tx as never, {
      companyId: 'comp-1',
      pedidoCompraId: 'po-1',
      pedidoNumero: 10,
      creditoFornecedorId: 'cred-1',
      creditoAplicado: 150,
    })

    expect(tx._credito.saldo).toBe(350)
    expect(Number(tx._reservas.get('po-1')?.valor)).toBe(150)
  })

  it('rejeita reserva acima do saldo', async () => {
    await expect(
      sincronizarReservaCreditoPedido(tx as never, {
        companyId: 'comp-1',
        pedidoCompraId: 'po-1',
        pedidoNumero: 10,
        creditoFornecedorId: 'cred-1',
        creditoAplicado: 600,
      })
    ).rejects.toBeInstanceOf(ErroDaAplicacao)
  })
})

describe('estornarReservaPedido', () => {
  it('devolve saldo ao cancelar pedido', async () => {
    const tx = criarTxMock()

    await sincronizarReservaCreditoPedido(tx as never, {
      companyId: 'comp-1',
      pedidoCompraId: 'po-1',
      pedidoNumero: 10,
      creditoFornecedorId: 'cred-1',
      creditoAplicado: 100,
    })

    await estornarReservaPedido(tx as never, 'po-1', 'comp-1', 10)

    expect(tx._credito.saldo).toBe(500)
    expect(tx._reservas.get('po-1')?.status).toBe('estornada')
  })
})

describe('baixarReservaPedido', () => {
  it('confirma baixa sem alterar saldo novamente', async () => {
    const tx = criarTxMock()

    await sincronizarReservaCreditoPedido(tx as never, {
      companyId: 'comp-1',
      pedidoCompraId: 'po-1',
      pedidoNumero: 10,
      creditoFornecedorId: 'cred-1',
      creditoAplicado: 100,
    })

    const saldoAposReserva = tx._credito.saldo
    const baixou = await baixarReservaPedido(tx as never, 'po-1', 'comp-1')

    expect(baixou).toBe(true)
    expect(tx._credito.saldo).toBe(saldoAposReserva)
    expect(tx._reservas.get('po-1')?.status).toBe('baixada')
    expect(tx._movimentos.some((m) => (m as { tipo: string }).tipo === 'baixa')).toBe(true)
  })
})
