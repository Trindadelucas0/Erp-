import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../repositorio-entrada-notas.js', () => ({
  repositorioEntradaNotas: {
    buscarFornecedorPorCnpj: vi.fn(),
    buscarProdutoPorGtin: vi.fn(),
    buscarProdutoPorCodigoOriginal: vi.fn(),
  },
}))

import { repositorioEntradaNotas } from '../repositorio-entrada-notas.js'
import { analisarCadastro } from './analisar-cadastro.js'

describe('analisarCadastro — auto-match de itens', () => {
  const base = {
    companyId: 'empresa-1',
    documentoEmitente: '11222333000181',
    fornecedorPessoaId: 'fornecedor-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('item sem produto e sem vinculoModo (primeira análise) ainda auto-matcha por GTIN', async () => {
    vi.mocked(repositorioEntradaNotas.buscarProdutoPorGtin).mockResolvedValue({ id: 'produto-1' } as never)

    const resultado = await analisarCadastro({
      ...base,
      itens: [{ id: 'item-1', gtin: '7891234567890', codigoProduto: null, produtoId: null, vinculoModo: null }],
    })

    expect(repositorioEntradaNotas.buscarProdutoPorGtin).toHaveBeenCalledWith('empresa-1', '7891234567890')
    expect(resultado.itensAtualizados[0]).toMatchObject({
      id: 'item-1',
      produtoId: 'produto-1',
      vinculoModo: 'barras',
      criticaCadastro: false,
    })
  })

  it('item desvinculado manualmente NÃO é religado por GTIN mesmo com produto cadastrado', async () => {
    vi.mocked(repositorioEntradaNotas.buscarProdutoPorGtin).mockResolvedValue({ id: 'produto-1' } as never)

    const resultado = await analisarCadastro({
      ...base,
      itens: [
        { id: 'item-1', gtin: '7891234567890', codigoProduto: null, produtoId: null, vinculoModo: 'desvinculado' },
      ],
    })

    expect(repositorioEntradaNotas.buscarProdutoPorGtin).not.toHaveBeenCalled()
    expect(resultado.itensAtualizados[0]).toMatchObject({
      id: 'item-1',
      produtoId: null,
      vinculoModo: 'desvinculado',
      criticaCadastro: true,
    })
    expect(resultado.resultado.status).toBe('bloqueante')
    expect(resultado.resultado.bloqueios[0]).toContain('Item desvinculado manualmente')
    expect(resultado.resultado.bloqueios[0]).not.toContain('Fornecedor')
  })

  it('item desvinculado manualmente também não é religado por código original', async () => {
    vi.mocked(repositorioEntradaNotas.buscarProdutoPorCodigoOriginal).mockResolvedValue({ id: 'produto-1' } as never)

    const resultado = await analisarCadastro({
      ...base,
      itens: [{ id: 'item-1', gtin: null, codigoProduto: 'ABC', produtoId: null, vinculoModo: 'desvinculado' }],
    })

    expect(repositorioEntradaNotas.buscarProdutoPorCodigoOriginal).not.toHaveBeenCalled()
    expect(resultado.itensAtualizados[0].produtoId).toBeNull()
  })

  it('item sem GTIN/código original cadastrado (nunca desvinculado) usa mensagem genérica de vínculo', async () => {
    vi.mocked(repositorioEntradaNotas.buscarProdutoPorGtin).mockResolvedValue(null as never)
    vi.mocked(repositorioEntradaNotas.buscarProdutoPorCodigoOriginal).mockResolvedValue(null as never)

    const resultado = await analisarCadastro({
      ...base,
      itens: [{ id: 'item-1', gtin: '000', codigoProduto: null, produtoId: null, vinculoModo: null }],
    })

    expect(resultado.resultado.bloqueios[0]).toContain('Item sem vínculo de produto')
    expect(resultado.resultado.bloqueios[0]).not.toContain('desvinculado')
  })

  it('vincular um item não afeta outro item que já tem produtoId', async () => {
    const resultado = await analisarCadastro({
      ...base,
      itens: [
        { id: 'item-1', gtin: '111', codigoProduto: null, produtoId: 'produto-manual', vinculoModo: 'manual' },
        { id: 'item-2', gtin: '222', codigoProduto: null, produtoId: null, vinculoModo: 'desvinculado' },
      ],
    })

    expect(repositorioEntradaNotas.buscarProdutoPorGtin).not.toHaveBeenCalled()
    expect(resultado.itensAtualizados).toEqual([
      { id: 'item-1', produtoId: 'produto-manual', vinculoModo: 'manual', criticaCadastro: false },
      { id: 'item-2', produtoId: null, vinculoModo: 'desvinculado', criticaCadastro: true },
    ])
  })

  it('NFe sem itens parseados é bloqueante (não só aviso)', async () => {
    const resultado = await analisarCadastro({
      ...base,
      itens: [],
    })

    expect(resultado.resultado.status).toBe('bloqueante')
    expect(resultado.resultado.bloqueios[0]).toContain('sem itens parseados')
    expect(resultado.resultado.avisos).toHaveLength(0)
  })

  it('exigirItens=false (NFS-e) não bloqueia por lista vazia', async () => {
    const resultado = await analisarCadastro({
      ...base,
      itens: [],
      exigirItens: false,
    })

    expect(resultado.resultado.bloqueios.some((b) => b.includes('sem itens'))).toBe(false)
  })
})
