/**
 * Match auto Entrada — caso imagem Quartzolit (item #1 Sem vínculo).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findFirstProduto = vi.fn()
const findFirstMaster = vi.fn()
const findFirstVinculo = vi.fn()
const findManyVinculo = vi.fn()

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    produto: { findFirst: (...a: unknown[]) => findFirstProduto(...a) },
    produtoEmbalagemMaster: { findFirst: (...a: unknown[]) => findFirstMaster(...a) },
    produtoFornecedor: {
      findFirst: (...a: unknown[]) => findFirstVinculo(...a),
      findMany: (...a: unknown[]) => findManyVinculo(...a),
    },
  },
}))

import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buscarProdutoPorGtin — variantes DUN-14', () => {
  it('NF 27894174203803 encontra produto cadastrado só com EAN-13 7894174203803', async () => {
    findFirstProduto
      .mockResolvedValueOnce(null) // exact DUN-14
      .mockResolvedValueOnce({
        id: 'prod-36l',
        nomeVenda: 'ADITIVO 3,6L',
        ncm: null,
        codigoOrigem: null,
      }) // últimos 13
    findFirstMaster.mockResolvedValue(null)

    const r = await repositorioEntradaNotas.buscarProdutoPorGtin('emp-1', '27894174203803')

    expect(r?.id).toBe('prod-36l')
    expect(r?.modo).toBe('barras')
    expect(findFirstProduto).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ codigoBarras: '27894174203803' }),
      })
    )
    expect(findFirstProduto).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ codigoBarras: '7894174203803' }),
      })
    )
  })
})

describe('buscarProdutoPorCodigoOriginal — normalização', () => {
  it('cProd 0563.00042.0360GL encontra vínculo 0563000420360GL', async () => {
    findFirstVinculo.mockResolvedValue(null)
    findManyVinculo.mockResolvedValue([
      {
        codigoFornecedor: '0563000420360GL',
        produto: {
          id: 'prod-36l',
          nomeVenda: 'ADITIVO 3,6L',
          ncm: null,
          codigoOrigem: null,
        },
      },
    ])

    const r = await repositorioEntradaNotas.buscarProdutoPorCodigoOriginal(
      'emp-1',
      'forn-1',
      '0563.00042.0360GL'
    )

    expect(r?.id).toBe('prod-36l')
    expect(r?.modo).toBe('codigo_original')
  })
})
