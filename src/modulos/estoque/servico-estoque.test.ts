import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('./repositorio-estoque.js', () => ({
  repositorioDeEstoque: {
    mapearSaldos: vi.fn((row) => ({
      qtdFisica: Number(row.qtdFisica),
      qtdReservada: Number(row.qtdReservada),
      qtdBloqueada: Number(row.qtdBloqueada),
      qtdFiscal: Number(row.qtdFiscal),
    })),
    buscarProdutoEstoque: vi.fn(),
    buscarMovimentoPorChave: vi.fn(),
    obterOuCriarSaldo: vi.fn(),
    atualizarSaldo: vi.fn(),
    criarMovimento: vi.fn(),
    buscarSaldo: vi.fn(),
    listarMovimentosPeriodo: vi.fn(),
    buscarUltimoMovimentoAntes: vi.fn(),
    listarSaldosComProduto: vi.fn(),
    garantirSaldoZero: vi.fn(),
    fornecedorVinculadoAoProduto: vi.fn(),
    existeMovimentoPorOrigem: vi.fn(),
    clientePrisma: {
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    },
  },
}))

import { repositorioDeEstoque } from './repositorio-estoque.js'
import { servicoDeEstoque, _testesEstoque } from './servico-estoque.js'

function produtoMock(extra: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    companyId: 'c1',
    sku: 'SKU1',
    nomeVenda: 'Cimento',
    nomeCompra: null,
    marca: 'X',
    unidade: 'SC',
    codigoBarras: null,
    ncm: null,
    codigoOrigem: null,
    multiploVenda: 1,
    precoCusto: 12.5,
    controlaEstoque: true,
    permiteEstoqueNegativo: true,
    bloqueadoVenda: false,
    ativo: true,
    fornecedores: [],
    ...extra,
  }
}

describe('cálculos de estoque', () => {
  it('monta ocorrência legível para inventário', () => {
    expect(
      _testesEstoque.montarOcorrencia({
        tipoMovimento: 'inventario',
        dimensao: 'fisico',
        origem: 'inventario',
      })
    ).toBe('Ajuste de inventário (estoque físico)')
  })

  it('calcula qtdDisponivel = fisico - reservada - bloqueada', () => {
    expect(
      _testesEstoque.calcularQtdDisponivel({
        qtdFisica: 300,
        qtdReservada: 100,
        qtdBloqueada: 0,
      })
    ).toBe(200)
  })

  it('aplica delta físico sem mexer no fiscal', () => {
    const { saldosNovos, saldoDepois } = _testesEstoque.aplicarDeltaNaDimensao(
      { qtdFisica: 100, qtdReservada: 0, qtdBloqueada: 0, qtdFiscal: 50 },
      'fisico',
      -10
    )
    expect(saldoDepois).toBe(90)
    expect(saldosNovos.qtdFisica).toBe(90)
    expect(saldosNovos.qtdFiscal).toBe(50)
  })

  it('delta disponível: físico soma; reserva/bloqueio subtrai', () => {
    expect(_testesEstoque.deltaDisponivelDoMovimento('fisico', 10)).toBe(10)
    expect(_testesEstoque.deltaDisponivelDoMovimento('reserva', 5)).toBe(-5)
    expect(_testesEstoque.deltaDisponivelDoMovimento('bloqueio', 3)).toBe(-3)
    expect(_testesEstoque.deltaDisponivelDoMovimento('fiscal', 20)).toBe(0)
  })
})

describe('registrarMovimentoEstoque', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeEstoque.clientePrisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({})
    )
  })

  it('retorna movimento existente na idempotência (sem gravar de novo)', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock({ permiteEstoqueNegativo: false }) as never
    )
    const movimentoExistente = {
      id: 'm1',
      dimensao: 'fisico',
      tipoMovimento: 'inventario',
      quantidade: -10,
      saldoDepois: 90,
      precoCusto: 12.5,
      origem: 'inventario',
      origemId: null,
      chaveIdempotencia: 'inv:1',
      observacao: 'ajuste',
      usuarioId: 'u1',
      pessoaId: null,
      createdAt: new Date('2026-08-01T12:00:00Z'),
    }
    vi.mocked(repositorioDeEstoque.buscarMovimentoPorChave).mockResolvedValue(
      movimentoExistente as never
    )
    vi.mocked(repositorioDeEstoque.buscarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 90,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 50,
    } as never)

    const resultado = await servicoDeEstoque.registrarMovimentoEstoque({
      companyId: 'c1',
      produtoId: 'p1',
      dimensao: 'fisico',
      tipoMovimento: 'inventario',
      quantidade: -10,
      origem: 'inventario',
      chaveIdempotencia: 'inv:1',
      observacao: 'ajuste',
      usuarioId: 'u1',
    })

    expect(resultado.idempotente).toBe(true)
    expect(resultado.movimento.id).toBe('m1')
    expect(repositorioDeEstoque.criarMovimento).not.toHaveBeenCalled()
  })

  it('recusa negativo quando produto não permite', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock({ permiteEstoqueNegativo: false }) as never
    )
    vi.mocked(repositorioDeEstoque.buscarMovimentoPorChave).mockResolvedValue(null)
    vi.mocked(repositorioDeEstoque.obterOuCriarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 5,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 5,
    } as never)

    await expect(
      servicoDeEstoque.registrarMovimentoEstoque({
        companyId: 'c1',
        produtoId: 'p1',
        dimensao: 'fisico',
        tipoMovimento: 'saida',
        quantidade: -10,
        origem: 'manual',
        chaveIdempotencia: 'manual:1',
      })
    ).rejects.toThrow(ErroDaAplicacao)

    await expect(
      servicoDeEstoque.registrarMovimentoEstoque({
        companyId: 'c1',
        produtoId: 'p1',
        dimensao: 'fisico',
        tipoMovimento: 'saida',
        quantidade: -10,
        origem: 'manual',
        chaveIdempotencia: 'manual:1',
      })
    ).rejects.toThrow(/físico negativo/)
  })

  it('inventário só mexe físico; fiscal permanece', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock() as never
    )
    vi.mocked(repositorioDeEstoque.buscarMovimentoPorChave).mockResolvedValue(null)
    vi.mocked(repositorioDeEstoque.obterOuCriarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 100,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 80,
    } as never)
    vi.mocked(repositorioDeEstoque.criarMovimento).mockResolvedValue({
      id: 'm2',
      dimensao: 'fisico',
      tipoMovimento: 'inventario',
      quantidade: -100,
      saldoDepois: 0,
      precoCusto: 12.5,
      origem: 'inventario',
      origemId: null,
      chaveIdempotencia: 'inv:x',
      observacao: 'zerar',
      usuarioId: 'u1',
      pessoaId: null,
      createdAt: new Date(),
    } as never)
    vi.mocked(repositorioDeEstoque.atualizarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 0,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 80,
    } as never)

    const resultado = await servicoDeEstoque.registrarMovimentoEstoque({
      companyId: 'c1',
      produtoId: 'p1',
      dimensao: 'fisico',
      tipoMovimento: 'inventario',
      quantidade: -100,
      origem: 'inventario',
      chaveIdempotencia: 'inv:x',
      observacao: 'zerar',
      usuarioId: 'u1',
    })

    expect(resultado.idempotente).toBe(false)
    expect(resultado.saldos.qtdFisica).toBe(0)
    expect(resultado.saldos.qtdFiscal).toBe(80)
    expect(repositorioDeEstoque.atualizarSaldo).toHaveBeenCalledWith(
      expect.anything(),
      's1',
      expect.objectContaining({ qtdFisica: 0, qtdFiscal: 80 })
    )
  })
})

describe('ajusteInventario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeEstoque.clientePrisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({})
    )
  })

  it('exige observação', async () => {
    await expect(
      servicoDeEstoque.ajusteInventario({
        companyId: 'c1',
        produtoId: 'p1',
        usuarioId: 'u1',
        observacao: '   ',
        quantidadeNova: 10,
      })
    ).rejects.toThrow(/Observação/)
  })

  it('calcula delta a partir de quantidadeNova, grava custo e não altera fiscal', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock() as never
    )
    vi.mocked(repositorioDeEstoque.buscarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 40,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 55,
    } as never)
    vi.mocked(repositorioDeEstoque.buscarMovimentoPorChave).mockResolvedValue(null)
    vi.mocked(repositorioDeEstoque.obterOuCriarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 40,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 55,
    } as never)
    vi.mocked(repositorioDeEstoque.criarMovimento).mockResolvedValue({
      id: 'm3',
      dimensao: 'fisico',
      tipoMovimento: 'inventario',
      quantidade: 10,
      saldoDepois: 50,
      precoCusto: 12.5,
      origem: 'inventario',
      origemId: null,
      chaveIdempotencia: 'inv:y',
      observacao: 'contagem',
      usuarioId: 'u1',
      pessoaId: null,
      createdAt: new Date(),
    } as never)
    vi.mocked(repositorioDeEstoque.atualizarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 50,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 55,
    } as never)

    const resultado = await servicoDeEstoque.ajusteInventario({
      companyId: 'c1',
      produtoId: 'p1',
      usuarioId: 'u1',
      observacao: 'contagem',
      quantidadeNova: 50,
    })

    expect(resultado.delta).toBe(10)
    expect(resultado.fiscalInalterado).toBe(true)
    expect(resultado.saldos.qtdFiscal).toBe(55)
    expect(resultado.saldos.qtdFisica).toBe(50)
    expect(resultado.precoCustoGravado).toBe(12.5)
    expect(resultado.avisoSemCusto).toBe(false)
    expect(repositorioDeEstoque.criarMovimento).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        quantidade: 10,
        precoCusto: 12.5,
        pessoaId: null,
      })
    )
  })

  it('recusa fornecedor não vinculado ao produto', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock() as never
    )
    vi.mocked(repositorioDeEstoque.buscarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 10,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 10,
    } as never)
    vi.mocked(repositorioDeEstoque.fornecedorVinculadoAoProduto).mockResolvedValue(null)

    await expect(
      servicoDeEstoque.ajusteInventario({
        companyId: 'c1',
        produtoId: 'p1',
        usuarioId: 'u1',
        observacao: 'ajuste com fornecedor',
        quantidadeNova: 12,
        fornecedorPessoaId: '11111111-1111-1111-1111-111111111111',
      })
    ).rejects.toThrow(/não está vinculado/)
  })

  it('aceita fornecedor vinculado e grava pessoaId no movimento', async () => {
    const fornecedorId = '22222222-2222-2222-2222-222222222222'
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock() as never
    )
    vi.mocked(repositorioDeEstoque.buscarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 10,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 10,
    } as never)
    vi.mocked(repositorioDeEstoque.fornecedorVinculadoAoProduto).mockResolvedValue({
      id: 'pf1',
    } as never)
    vi.mocked(repositorioDeEstoque.buscarMovimentoPorChave).mockResolvedValue(null)
    vi.mocked(repositorioDeEstoque.obterOuCriarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 10,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 10,
    } as never)
    vi.mocked(repositorioDeEstoque.criarMovimento).mockResolvedValue({
      id: 'm4',
      dimensao: 'fisico',
      tipoMovimento: 'inventario',
      quantidade: 2,
      saldoDepois: 12,
      precoCusto: 12.5,
      origem: 'inventario',
      origemId: null,
      chaveIdempotencia: 'inv:z',
      observacao: 'com fornecedor',
      usuarioId: 'u1',
      pessoaId: fornecedorId,
      createdAt: new Date(),
    } as never)
    vi.mocked(repositorioDeEstoque.atualizarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 12,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 10,
    } as never)

    await servicoDeEstoque.ajusteInventario({
      companyId: 'c1',
      produtoId: 'p1',
      usuarioId: 'u1',
      observacao: 'com fornecedor',
      quantidadeNova: 12,
      fornecedorPessoaId: fornecedorId,
    })

    expect(repositorioDeEstoque.criarMovimento).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pessoaId: fornecedorId, precoCusto: 12.5 })
    )
  })

  it('aceita delta de entrada e override de precoCusto', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock() as never
    )
    vi.mocked(repositorioDeEstoque.buscarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 20,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 20,
    } as never)
    vi.mocked(repositorioDeEstoque.buscarMovimentoPorChave).mockResolvedValue(null)
    vi.mocked(repositorioDeEstoque.obterOuCriarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 20,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 20,
    } as never)
    vi.mocked(repositorioDeEstoque.criarMovimento).mockResolvedValue({
      id: 'm5',
      dimensao: 'fisico',
      tipoMovimento: 'inventario',
      quantidade: 5,
      saldoDepois: 25,
      precoCusto: 9.99,
      origem: 'inventario',
      origemId: null,
      chaveIdempotencia: 'inv:delta',
      observacao: 'entrada',
      usuarioId: 'u1',
      pessoaId: null,
      createdAt: new Date(),
    } as never)
    vi.mocked(repositorioDeEstoque.atualizarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 25,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 20,
    } as never)

    const resultado = await servicoDeEstoque.ajusteInventario({
      companyId: 'c1',
      produtoId: 'p1',
      usuarioId: 'u1',
      observacao: 'entrada',
      delta: 5,
      precoCusto: 9.99,
    })

    expect(resultado.delta).toBe(5)
    expect(resultado.precoCustoGravado).toBe(9.99)
    expect(repositorioDeEstoque.criarMovimento).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ quantidade: 5, precoCusto: 9.99 })
    )
  })

  it('grava precoCusto null quando override explícito', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock() as never
    )
    vi.mocked(repositorioDeEstoque.buscarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 10,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 10,
    } as never)
    vi.mocked(repositorioDeEstoque.buscarMovimentoPorChave).mockResolvedValue(null)
    vi.mocked(repositorioDeEstoque.obterOuCriarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 10,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 10,
    } as never)
    vi.mocked(repositorioDeEstoque.criarMovimento).mockResolvedValue({
      id: 'm6',
      dimensao: 'fisico',
      tipoMovimento: 'inventario',
      quantidade: -2,
      saldoDepois: 8,
      precoCusto: null,
      origem: 'inventario',
      origemId: null,
      chaveIdempotencia: 'inv:null',
      observacao: 'saida sem custo',
      usuarioId: 'u1',
      pessoaId: null,
      createdAt: new Date(),
    } as never)
    vi.mocked(repositorioDeEstoque.atualizarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 8,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 10,
    } as never)

    const resultado = await servicoDeEstoque.ajusteInventario({
      companyId: 'c1',
      produtoId: 'p1',
      usuarioId: 'u1',
      observacao: 'saida sem custo',
      delta: -2,
      precoCusto: null,
    })

    expect(resultado.avisoSemCusto).toBe(true)
    expect(resultado.precoCustoGravado).toBeNull()
    expect(repositorioDeEstoque.criarMovimento).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ quantidade: -2, precoCusto: null })
    )
  })
})

describe('aplicarEntradaNotaFiscal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeEstoque.clientePrisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({})
    )
    vi.mocked(repositorioDeEstoque.buscarMovimentoPorChave).mockResolvedValue(null)
    vi.mocked(repositorioDeEstoque.obterOuCriarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 0,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 0,
    } as never)
    vi.mocked(repositorioDeEstoque.atualizarSaldo).mockImplementation(
      async (_tx, _id, saldos) =>
        ({
          id: 's1',
          qtdFisica: saldos.qtdFisica,
          qtdReservada: saldos.qtdReservada,
          qtdBloqueada: saldos.qtdBloqueada,
          qtdFiscal: saldos.qtdFiscal,
        }) as never
    )
    vi.mocked(repositorioDeEstoque.criarMovimento).mockImplementation(
      async (_tx, dados) =>
        ({
          id: `m-${dados.chaveIdempotencia}`,
          dimensao: dados.dimensao,
          tipoMovimento: dados.tipoMovimento,
          quantidade: dados.quantidade,
          saldoDepois: dados.saldoDepois,
          precoCusto: dados.precoCusto ?? null,
          origem: dados.origem,
          origemId: dados.origemId ?? null,
          chaveIdempotencia: dados.chaveIdempotencia,
          observacao: dados.observacao ?? null,
          usuarioId: dados.usuarioId ?? null,
          pessoaId: dados.pessoaId ?? null,
          createdAt: new Date('2026-08-04T12:00:00Z'),
        }) as never
    )
  })

  it('grava físico e fiscal com chaves idempotentes', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock() as never
    )

    const resultado = await servicoDeEstoque.aplicarEntradaNotaFiscal({
      companyId: 'c1',
      notaId: 'nota-1',
      usuarioId: 'u1',
      pessoaId: 'forn-1',
      linhas: [
        {
          itemId: 'item-1',
          produtoId: 'p1',
          quantidadeEstoque: 10,
          precoCusto: 5.5,
          nomeVenda: 'Cimento',
        },
      ],
    })

    expect(resultado.movimentou).toBe(true)
    expect(resultado.itensProcessados).toBe(1)
    expect(resultado.itensIgnorados).toBe(0)
    expect(resultado.movimentosGravados).toBe(2)
    expect(resultado.produtos).toEqual([
      { produtoId: 'p1', nomeVenda: 'Cimento', quantidade: 10 },
    ])
    expect(repositorioDeEstoque.criarMovimento).toHaveBeenCalledTimes(2)
    expect(repositorioDeEstoque.criarMovimento).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        dimensao: 'fisico',
        tipoMovimento: 'entrada_nf',
        origem: 'nfe',
        origemId: 'nota-1',
        chaveIdempotencia: 'nfe:nota-1:item:item-1:fisico',
        quantidade: 10,
        precoCusto: 5.5,
        pessoaId: 'forn-1',
      })
    )
    expect(repositorioDeEstoque.criarMovimento).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        dimensao: 'fiscal',
        chaveIdempotencia: 'nfe:nota-1:item:item-1:fiscal',
      })
    )
  })

  it('ignora produto que não controla estoque', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock({ controlaEstoque: false }) as never
    )

    const resultado = await servicoDeEstoque.aplicarEntradaNotaFiscal({
      companyId: 'c1',
      notaId: 'nota-1',
      usuarioId: 'u1',
      linhas: [
        {
          itemId: 'item-1',
          produtoId: 'p1',
          quantidadeEstoque: 10,
          precoCusto: 1,
        },
      ],
    })

    expect(resultado.movimentou).toBe(false)
    expect(resultado.itensIgnorados).toBe(1)
    expect(resultado.itensProcessados).toBe(0)
    expect(repositorioDeEstoque.criarMovimento).not.toHaveBeenCalled()
  })

  it('é idempotente na segunda chamada (não conta movimentos novos)', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock() as never
    )
    const existente = {
      id: 'm-exist',
      dimensao: 'fisico',
      tipoMovimento: 'entrada_nf',
      quantidade: 10,
      saldoDepois: 10,
      precoCusto: 5.5,
      origem: 'nfe',
      origemId: 'nota-1',
      chaveIdempotencia: 'nfe:nota-1:item:item-1:fisico',
      observacao: null,
      usuarioId: 'u1',
      pessoaId: null,
      createdAt: new Date(),
    }
    vi.mocked(repositorioDeEstoque.buscarMovimentoPorChave).mockImplementation(
      async (_c, chave) => {
        if (chave.includes(':fisico')) return existente as never
        return {
          ...existente,
          id: 'm-fiscal',
          dimensao: 'fiscal',
          chaveIdempotencia: 'nfe:nota-1:item:item-1:fiscal',
        } as never
      }
    )
    vi.mocked(repositorioDeEstoque.buscarSaldo).mockResolvedValue({
      id: 's1',
      qtdFisica: 10,
      qtdReservada: 0,
      qtdBloqueada: 0,
      qtdFiscal: 10,
    } as never)

    const resultado = await servicoDeEstoque.aplicarEntradaNotaFiscal({
      companyId: 'c1',
      notaId: 'nota-1',
      usuarioId: 'u1',
      linhas: [
        {
          itemId: 'item-1',
          produtoId: 'p1',
          quantidadeEstoque: 10,
          precoCusto: 5.5,
        },
      ],
    })

    expect(resultado.itensProcessados).toBe(1)
    expect(resultado.movimentosGravados).toBe(0)
    expect(repositorioDeEstoque.criarMovimento).not.toHaveBeenCalled()
  })

  it('rejeita quantidade inválida quando produto controla estoque', async () => {
    vi.mocked(repositorioDeEstoque.buscarProdutoEstoque).mockResolvedValue(
      produtoMock() as never
    )

    await expect(
      servicoDeEstoque.aplicarEntradaNotaFiscal({
        companyId: 'c1',
        notaId: 'nota-1',
        usuarioId: 'u1',
        linhas: [
          {
            itemId: 'item-1',
            produtoId: 'p1',
            quantidadeEstoque: 0,
            precoCusto: 1,
          },
        ],
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
