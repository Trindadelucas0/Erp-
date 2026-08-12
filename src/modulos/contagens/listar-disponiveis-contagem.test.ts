import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    contagemEntradaNota: { findMany: vi.fn() },
    nfeRecebida: { findMany: vi.fn(), updateMany: vi.fn() },
    contagemEntrada: { findMany: vi.fn(), update: vi.fn() },
    contagemEntradaItem: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { repositorioContagens } from './repositorio-contagens.js'
import { servicoContagens } from './servico-contagens.js'

const notaBase = {
  id: 'nota-1',
  chaveNfe: '35260812345678000190550010002651121234567890',
  nomeEmitente: 'Fornecedor Teste',
  documentoEmitente: '12345678000190',
  dataEmissao: new Date('2026-08-01'),
  tipoDocumento: 'nfe55',
  statusEntrada: 'entrada_contagem',
  itens: [{ produtoId: 'prod-1' }],
}

describe('listarDisponiveis — sessão ativa oculta nota mas expõe retomada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(clientePrisma.contagemEntradaNota.findMany).mockResolvedValue([
      { nfeRecebidaId: 'nota-1' },
    ] as never)
    vi.mocked(clientePrisma.nfeRecebida.findMany).mockResolvedValue([notaBase] as never)
    vi.mocked(clientePrisma.contagemEntrada.findMany).mockResolvedValue([
      {
        id: 'sessao-1',
        status: 'em_andamento',
        iniciadoEm: new Date('2026-08-12T10:00:00'),
        notas: [
          {
            nfeRecebida: {
              id: 'nota-1',
              chaveNfe: notaBase.chaveNfe,
              nomeEmitente: notaBase.nomeEmitente,
              documentoEmitente: notaBase.documentoEmitente,
              dataEmissao: notaBase.dataEmissao,
              statusEntrada: 'entrada_contagem',
            },
          },
        ],
      },
    ] as never)
  })

  it('nota em sessão ativa não aparece em notas, mas aparece em sessoesAtivas', async () => {
    const resultado = await servicoContagens.listarDisponiveis('company-1')

    expect(resultado.notas).toHaveLength(0)
    expect(resultado.sessoesAtivas).toHaveLength(1)
    expect(resultado.sessoesAtivas[0]?.id).toBe('sessao-1')
    expect(resultado.sessoesAtivas[0]?.entradas[0]?.id).toBe('nota-1')
    expect(resultado.ignoradas.some((n) => n.id === 'nota-1')).toBe(true)
  })
})

describe('cancelarSessao — libera nota para nova contagem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(clientePrisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        contagemEntrada: { update: vi.fn() },
        nfeRecebida: { updateMany: vi.fn() },
      }
      return fn(tx as never)
    })
  })

  it('restaura statusEntrada para entrada_contagem', async () => {
    await repositorioContagens.cancelarSessao({
      sessaoId: 'sessao-1',
      nfeRecebidaIds: ['nota-1'],
    })

    const txFn = vi.mocked(clientePrisma.$transaction).mock.calls[0]?.[0] as (
      tx: {
        contagemEntrada: { update: ReturnType<typeof vi.fn> }
        nfeRecebida: { updateMany: ReturnType<typeof vi.fn> }
      }
    ) => Promise<unknown>

    const tx = {
      contagemEntrada: { update: vi.fn() },
      nfeRecebida: { updateMany: vi.fn() },
    }
    await txFn(tx)

    expect(tx.contagemEntrada.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sessao-1' },
        data: expect.objectContaining({ status: 'cancelada' }),
      })
    )
    expect(tx.nfeRecebida.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['nota-1'] },
        statusEntrada: {
          in: ['entrada_contagem', 'entrada_contagem_ok', 'entrada_contagem_divergente'],
        },
      },
      data: { statusEntrada: 'entrada_contagem' },
    })
  })
})

describe('criarSessao — não altera statusEntrada da NF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(clientePrisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        contagemEntrada: {
          create: vi.fn().mockResolvedValue({ id: 'sessao-nova' }),
        },
        nfeRecebida: { updateMany: vi.fn() },
      }
      return fn(tx as never)
    })
  })

  it('não chama updateMany em nfeRecebida ao criar sessão', async () => {
    await repositorioContagens.criarSessao({
      companyId: 'company-1',
      usuarioId: 'user-1',
      nfeRecebidaIds: ['nota-1'],
      itens: [
        {
          produtoId: 'prod-1',
          nomeExibicao: 'Produto',
          codigoBarras: null,
          codigoOriginal: null,
          marca: null,
          unidade: 'UN',
          qtdEmbalagemPadrao: 1,
          qtdEsperada: 10,
        },
      ],
    })

    const txFn = vi.mocked(clientePrisma.$transaction).mock.calls[0]?.[0] as (
      tx: {
        contagemEntrada: { create: ReturnType<typeof vi.fn> }
        nfeRecebida: { updateMany: ReturnType<typeof vi.fn> }
      }
    ) => Promise<unknown>

    const tx = {
      contagemEntrada: {
        create: vi.fn().mockResolvedValue({ id: 'sessao-nova' }),
      },
      nfeRecebida: { updateMany: vi.fn() },
    }
    await txFn(tx)

    expect(tx.nfeRecebida.updateMany).not.toHaveBeenCalled()
  })
})
