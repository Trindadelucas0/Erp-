import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    nfeRecebida: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { repositorioFocusNfe } from './repositorio-focus-nfe.js'

describe('listarNfesPorPainel — Canceladas', () => {
  beforeEach(() => {
    vi.mocked(clientePrisma.nfeRecebida.findMany).mockReset()
    vi.mocked(clientePrisma.nfeRecebida.count).mockReset()
    vi.mocked(clientePrisma.nfeRecebida.findMany).mockResolvedValue([] as never)
    vi.mocked(clientePrisma.nfeRecebida.count).mockResolvedValue(0 as never)
  })

  it('exclui CT-e do painel Canceladas', async () => {
    await repositorioFocusNfe.listarNfesPorPainel('emp-1', { painel: 'cancelada' })
    expect(vi.mocked(clientePrisma.nfeRecebida.findMany).mock.calls[0][0]).toMatchObject({
      where: {
        companyId: 'emp-1',
        statusEntrada: { in: ['cancelada'] },
        tipoDocumento: { not: 'cte' },
      },
    })
  })

  it('não filtra tipo no painel Em análise', async () => {
    await repositorioFocusNfe.listarNfesPorPainel('emp-1', { painel: 'analise' })
    const where = vi.mocked(clientePrisma.nfeRecebida.findMany).mock.calls[0][0].where as Record<
      string,
      unknown
    >
    expect(where.tipoDocumento).toBeUndefined()
  })

  it('painel Prontas para consolidar filtra só pronta_para_consolidar', async () => {
    await repositorioFocusNfe.listarNfesPorPainel('emp-1', { painel: 'pronta_consolidar' })
    expect(vi.mocked(clientePrisma.nfeRecebida.findMany).mock.calls[0][0]).toMatchObject({
      where: {
        companyId: 'emp-1',
        statusEntrada: { in: ['pronta_para_consolidar'] },
      },
    })
  })

  it('contarCtesForaDoFiltroData no painel Canceladas retorna 0', async () => {
    const n = await repositorioFocusNfe.contarCtesForaDoFiltroData('emp-1', {
      painel: 'cancelada',
      dataDe: new Date('2026-09-01'),
      dataAte: new Date('2026-09-10'),
    })
    expect(n).toBe(0)
    expect(clientePrisma.nfeRecebida.count).not.toHaveBeenCalled()
  })
})
