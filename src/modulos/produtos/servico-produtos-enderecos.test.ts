import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn(),
}))

vi.mock('./repositorio-produtos.js', () => ({
  repositorioDeProdutos: {
    buscarPorId: vi.fn(),
    substituirEnderecosEstoque: vi.fn(),
  },
}))

import { repositorioDeProdutos } from './repositorio-produtos.js'
import { servicoDeProdutos } from './servico-produtos.js'

describe('substituirEnderecosEstoque', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('grava só endereços quando o produto é da empresa', async () => {
    vi.mocked(repositorioDeProdutos.buscarPorId).mockResolvedValue({
      id: 'prod-1',
      companyId: 'company-001',
    } as never)
    vi.mocked(repositorioDeProdutos.substituirEnderecosEstoque).mockResolvedValue({
      id: 'prod-1',
      enderecosEstoque: [{ endereco: 'A-CQ-01-01-1-01' }],
      fornecedores: [{ fornecedorPessoaId: 'forn-1' }],
    } as never)

    const produto = await servicoDeProdutos.substituirEnderecosEstoque(
      'prod-1',
      { enderecosEstoque: [{ endereco: 'A-CQ-01-01-1-01' }] },
      'company-001',
      'user-001'
    )

    expect(repositorioDeProdutos.substituirEnderecosEstoque).toHaveBeenCalledWith(
      'prod-1',
      'company-001',
      [{ endereco: 'A-CQ-01-01-1-01' }]
    )
    expect(produto.fornecedores).toEqual([{ fornecedorPessoaId: 'forn-1' }])
  })

  it('404 se o produto é de outro tenant', async () => {
    vi.mocked(repositorioDeProdutos.buscarPorId).mockResolvedValue({
      id: 'prod-1',
      companyId: 'outra',
    } as never)

    await expect(
      servicoDeProdutos.substituirEnderecosEstoque(
        'prod-1',
        { enderecosEstoque: [] },
        'company-001',
        'user-001'
      )
    ).rejects.toMatchObject({ message: 'Produto não encontrado', codigoHttp: 404 })
    expect(repositorioDeProdutos.substituirEnderecosEstoque).not.toHaveBeenCalled()
  })
})
