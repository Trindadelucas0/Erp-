import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('./repositorio-planos-financeiros.js', () => ({
  repositorioDePlanosFinanceiros: {
    buscarPorId: vi.fn(),
    contarFilhosAtivos: vi.fn(),
    alterarAtivo: vi.fn(),
    mapear: vi.fn((plano: Record<string, unknown>) => plano),
  },
}))

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}))

import { servicoDePlanosFinanceiros } from './servico-planos-financeiros.js'
import { repositorioDePlanosFinanceiros } from './repositorio-planos-financeiros.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

const planoBase = {
  id: 'plano-001',
  codigo: '2.1',
  nome: 'Despesas operacionais',
  tipo: 'despesa',
  classificacao: null,
  mostrarNaDre: true,
  permiteLancamentoManual: false,
  exigeAnexoLancamento: false,
  permiteUsoConsumo: false,
  parentId: null,
  ativo: true,
  createdAt: new Date('2026-01-01'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('servicoDePlanosFinanceiros.alterarStatus', () => {
  it('lança 400 quando plano tem filhos ativos e tenta desativar', async () => {
    vi.mocked(repositorioDePlanosFinanceiros.buscarPorId).mockResolvedValue(planoBase)
    vi.mocked(repositorioDePlanosFinanceiros.contarFilhosAtivos).mockResolvedValue(2)

    await expect(
      servicoDePlanosFinanceiros.alterarStatus('company-001', 'plano-001', false, 'user-001')
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(
      servicoDePlanosFinanceiros.alterarStatus('company-001', 'plano-001', false, 'user-001')
    ).rejects.toThrow('Desative os planos filhos antes de desativar este plano')

    expect(repositorioDePlanosFinanceiros.alterarAtivo).not.toHaveBeenCalled()
  })

  it('desativa plano folha sem filhos ativos', async () => {
    vi.mocked(repositorioDePlanosFinanceiros.buscarPorId).mockResolvedValue(planoBase)
    vi.mocked(repositorioDePlanosFinanceiros.contarFilhosAtivos).mockResolvedValue(0)
    vi.mocked(repositorioDePlanosFinanceiros.alterarAtivo).mockResolvedValue({
      ...planoBase,
      ativo: false,
    })

    const resultado = await servicoDePlanosFinanceiros.alterarStatus(
      'company-001',
      'plano-001',
      false,
      'user-001'
    )

    expect(repositorioDePlanosFinanceiros.alterarAtivo).toHaveBeenCalledWith(
      'company-001',
      'plano-001',
      false
    )
    expect(resultado.ativo).toBe(false)
    expect(resultado.descricao).toBe(planoBase.nome)
  })

  it('lança 404 quando plano não existe', async () => {
    vi.mocked(repositorioDePlanosFinanceiros.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDePlanosFinanceiros.alterarStatus('company-001', 'inexistente', false, 'user-001')
    ).rejects.toBeInstanceOf(ErroDaAplicacao)

    await expect(
      servicoDePlanosFinanceiros.alterarStatus('company-001', 'inexistente', false, 'user-001')
    ).rejects.toThrow('Plano financeiro não encontrado')
  })
})
