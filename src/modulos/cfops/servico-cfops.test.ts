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
