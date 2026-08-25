import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn(),
}))

vi.mock('./repositorio-cfops.js', () => ({
  repositorioDeCfops: {
    buscarPorCodigo: vi.fn(),
    buscarPorId: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    validarIdsEntradaFornecedor: vi.fn(),
    validarPlanoFinanceiroAtivo: vi.fn(),
    mapear: vi.fn((cfop) => cfop),
  },
}))

import { repositorioDeCfops } from './repositorio-cfops.js'
import { servicoDeCfops } from './servico-cfops.js'

describe('servicoDeCfops.cfopSugestaoEntrada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejeita sugestão em CFOP de entrada', async () => {
    vi.mocked(repositorioDeCfops.buscarPorCodigo).mockResolvedValue(null)

    await expect(
      servicoDeCfops.criarCfop(
        'company-001',
        {
          codigo: '1.101',
          nome: 'Entrada teste',
          descricao: '',
          subtipoCfop: null,
          aproveitarCreditoIcms: false,
          cfopSugestaoEntradaId: 'cfop-entrada-001',
        },
        'user-001'
      )
    ).rejects.toThrow(ErroDaAplicacao)

    await expect(
      servicoDeCfops.criarCfop(
        'company-001',
        {
          codigo: '1.101',
          nome: 'Entrada teste',
          descricao: '',
          subtipoCfop: null,
          aproveitarCreditoIcms: false,
          cfopSugestaoEntradaId: 'cfop-entrada-001',
        },
        'user-001'
      )
    ).rejects.toThrow('Sugestão de entrada só se aplica a CFOP de saída')
  })

  it('permite CFOP de saída sem sugestão', async () => {
    vi.mocked(repositorioDeCfops.buscarPorCodigo).mockResolvedValue(null)
    vi.mocked(repositorioDeCfops.criar).mockResolvedValue({
      id: 'cfop-saida-001',
      codigo: '5.101',
      nome: 'Saída teste',
      descricao: '',
      tipoCfop: '01',
      natureza: 'saida',
      abrangencia: 'estadual',
      subtipoCfop: null,
      aproveitarCreditoIcms: false,
      tipo: 'saida',
      ativo: true,
      cfopSugestaoEntradaId: null,
      cfopSugestaoEntrada: null,
      planoFinanceiroPadraoId: null,
      planoFinanceiroPadrao: null,
      createdAt: new Date(),
    })

    const resultado = await servicoDeCfops.criarCfop(
      'company-001',
      {
        codigo: '5.101',
        nome: 'Saída teste',
        descricao: '',
        subtipoCfop: null,
        aproveitarCreditoIcms: false,
        cfopSugestaoEntradaId: null,
      },
      'user-001'
    )

    expect(resultado.codigo).toBe('5.101')
    expect(repositorioDeCfops.criar).toHaveBeenCalledWith('company-001', {
      codigo: '5.101',
      nome: 'Saída teste',
      descricao: '',
      subtipoCfop: null,
      aproveitarCreditoIcms: false,
      cfopSugestaoEntradaId: null,
      planoFinanceiroPadraoId: null,
    })
  })

  it('rejeita auto-vínculo na edição', async () => {
    vi.mocked(repositorioDeCfops.buscarPorId).mockResolvedValue({
      id: 'cfop-saida-001',
      codigo: '5.101',
      nome: 'Saída teste',
      descricao: '',
      tipoCfop: '02',
      natureza: 'saida',
      abrangencia: 'estadual',
      subtipoCfop: null,
      aproveitarCreditoIcms: false,
      tipo: 'saida',
      ativo: true,
      cfopSugestaoEntradaId: null,
      companyId: 'company-001',
      createdAt: new Date(),
      cfopSugestaoEntrada: null,
      planoFinanceiroPadraoId: null,
      planoFinanceiroPadrao: null,
    } as never)

    await expect(
      servicoDeCfops.editarCfop(
        'company-001',
        'cfop-saida-001',
        {
          nome: 'Saída teste',
          descricao: '',
          subtipoCfop: null,
          aproveitarCreditoIcms: false,
          cfopSugestaoEntradaId: 'cfop-saida-001',
        },
        'user-001'
      )
    ).rejects.toThrow('CFOP não pode ser sugestão de si mesmo')
  })
})

describe('servicoDeCfops.planoFinanceiroPadrao', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejeita plano financeiro padrão em CFOP de entrada', async () => {
    vi.mocked(repositorioDeCfops.buscarPorCodigo).mockResolvedValue(null)

    await expect(
      servicoDeCfops.criarCfop(
        'company-001',
        {
          codigo: '1.101',
          nome: 'Entrada teste',
          descricao: '',
          subtipoCfop: null,
          aproveitarCreditoIcms: false,
          planoFinanceiroPadraoId: 'plano-001',
        },
        'user-001'
      )
    ).rejects.toThrow('Plano financeiro padrão só se aplica a CFOP de saída')

    expect(repositorioDeCfops.validarPlanoFinanceiroAtivo).not.toHaveBeenCalled()
  })

  it('permite CFOP de saída com plano financeiro ativo', async () => {
    vi.mocked(repositorioDeCfops.buscarPorCodigo).mockResolvedValue(null)
    vi.mocked(repositorioDeCfops.validarPlanoFinanceiroAtivo).mockResolvedValue(undefined)
    vi.mocked(repositorioDeCfops.criar).mockResolvedValue({
      id: 'cfop-saida-001',
      codigo: '5.101',
      nome: 'Saída teste',
      descricao: '',
      tipoCfop: '02',
      natureza: 'saida',
      abrangencia: 'estadual',
      subtipoCfop: null,
      aproveitarCreditoIcms: false,
      tipo: 'saida',
      ativo: true,
      cfopSugestaoEntradaId: null,
      cfopSugestaoEntrada: null,
      planoFinanceiroPadraoId: 'plano-001',
      planoFinanceiroPadrao: {
        id: 'plano-001',
        codigo: '2.01.01',
        descricao: 'Compras',
      },
      createdAt: new Date(),
    })

    const resultado = await servicoDeCfops.criarCfop(
      'company-001',
      {
        codigo: '5.101',
        nome: 'Saída teste',
        descricao: '',
        subtipoCfop: null,
        aproveitarCreditoIcms: false,
        planoFinanceiroPadraoId: 'plano-001',
      },
      'user-001'
    )

    expect(resultado.planoFinanceiroPadraoId).toBe('plano-001')
    expect(repositorioDeCfops.validarPlanoFinanceiroAtivo).toHaveBeenCalledWith(
      'company-001',
      'plano-001'
    )
    expect(repositorioDeCfops.criar).toHaveBeenCalledWith('company-001', {
      codigo: '5.101',
      nome: 'Saída teste',
      descricao: '',
      subtipoCfop: null,
      aproveitarCreditoIcms: false,
      cfopSugestaoEntradaId: null,
      planoFinanceiroPadraoId: 'plano-001',
    })
  })

  it('rejeita plano financeiro em CFOP de importação', async () => {
    vi.mocked(repositorioDeCfops.buscarPorCodigo).mockResolvedValue(null)

    await expect(
      servicoDeCfops.criarCfop(
        'company-001',
        {
          codigo: '3.101',
          nome: 'Importação teste',
          descricao: '',
          subtipoCfop: null,
          aproveitarCreditoIcms: false,
          planoFinanceiroPadraoId: 'plano-001',
        },
        'user-001'
      )
    ).rejects.toThrow('Plano financeiro padrão só se aplica a CFOP de saída')

    expect(repositorioDeCfops.validarPlanoFinanceiroAtivo).not.toHaveBeenCalled()
  })

  it('propaga erro quando plano financeiro é inválido', async () => {
    vi.mocked(repositorioDeCfops.buscarPorCodigo).mockResolvedValue(null)
    vi.mocked(repositorioDeCfops.validarPlanoFinanceiroAtivo).mockRejectedValue(
      new Error('Plano financeiro não encontrado ou inativo')
    )

    await expect(
      servicoDeCfops.criarCfop(
        'company-001',
        {
          codigo: '5.101',
          nome: 'Saída teste',
          descricao: '',
          subtipoCfop: null,
          aproveitarCreditoIcms: false,
          planoFinanceiroPadraoId: 'plano-inexistente',
        },
        'user-001'
      )
    ).rejects.toThrow('Plano financeiro não encontrado ou inativo')
  })

  it('zera plano na edição de CFOP de entrada', async () => {
    vi.mocked(repositorioDeCfops.buscarPorId).mockResolvedValue({
      id: 'cfop-entrada-001',
      codigo: '1.101',
      nome: 'Entrada teste',
      descricao: '',
      tipoCfop: '01',
      natureza: 'entrada',
      abrangencia: 'estadual',
      subtipoCfop: null,
      aproveitarCreditoIcms: false,
      tipo: 'entrada',
      ativo: true,
      cfopSugestaoEntradaId: null,
      companyId: 'company-001',
      createdAt: new Date(),
      cfopSugestaoEntrada: null,
      planoFinanceiroPadraoId: 'plano-legado',
      planoFinanceiroPadrao: {
        id: 'plano-legado',
        codigo: '2.01.01',
        descricao: 'Compras',
      },
    } as never)
    vi.mocked(repositorioDeCfops.atualizar).mockResolvedValue({
      id: 'cfop-entrada-001',
      codigo: '1.101',
      nome: 'Entrada editada',
      descricao: '',
      tipoCfop: '01',
      natureza: 'entrada',
      abrangencia: 'estadual',
      subtipoCfop: null,
      aproveitarCreditoIcms: false,
      tipo: 'entrada',
      ativo: true,
      cfopSugestaoEntradaId: null,
      cfopSugestaoEntrada: null,
      planoFinanceiroPadraoId: null,
      planoFinanceiroPadrao: null,
      createdAt: new Date(),
    })

    await servicoDeCfops.editarCfop(
      'company-001',
      'cfop-entrada-001',
      {
        nome: 'Entrada editada',
        descricao: '',
        subtipoCfop: null,
        aproveitarCreditoIcms: false,
        planoFinanceiroPadraoId: null,
      },
      'user-001'
    )

    expect(repositorioDeCfops.atualizar).toHaveBeenCalledWith(
      'company-001',
      'cfop-entrada-001',
      expect.objectContaining({ planoFinanceiroPadraoId: null }),
      '1.101'
    )
  })
})
