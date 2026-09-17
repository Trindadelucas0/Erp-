import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    produtoEnderecoEstoque: {
      count: vi.fn(),
    },
  },
}))

import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { contarProdutosNosCodigos } from './vinculo-produto-endereco-wms.js'

describe('contarProdutosNosCodigos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 0 sem códigos', async () => {
    await expect(contarProdutosNosCodigos('company-001', [])).resolves.toBe(0)
    expect(clientePrisma.produtoEnderecoEstoque.count).not.toHaveBeenCalled()
  })

  it('filtra pela empresa e pelos códigos', async () => {
    vi.mocked(clientePrisma.produtoEnderecoEstoque.count).mockResolvedValue(2)
    await expect(
      contarProdutosNosCodigos('company-001', ['A-RC-20-01-2-05', 'A-RC-20-01-2-05'])
    ).resolves.toBe(2)
    expect(clientePrisma.produtoEnderecoEstoque.count).toHaveBeenCalledWith({
      where: {
        endereco: { in: ['A-RC-20-01-2-05'] },
        produto: { companyId: 'company-001' },
      },
    })
  })
})
