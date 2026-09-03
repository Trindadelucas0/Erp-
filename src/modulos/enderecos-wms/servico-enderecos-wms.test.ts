import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn(),
}))

vi.mock('./repositorio-enderecos-wms.js', () => ({
  repositorioDeEnderecosWms: {
    buscarPorCodigo: vi.fn(),
    buscarPorId: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    listarPorEmpresa: vi.fn(),
  },
}))

import { repositorioDeEnderecosWms } from './repositorio-enderecos-wms.js'
import { servicoDeEnderecosWms } from './servico-enderecos-wms.js'

const componentesValidos = {
  local: 'A' as const,
  area: 'RC' as const,
  tipo: 'CH' as const,
  rua: '20',
  andar: '2',
  posicao: '05',
}

describe('servicoDeEnderecosWms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cria endereço válido e recusa duplicata com 409', async () => {
    vi.mocked(repositorioDeEnderecosWms.buscarPorCodigo).mockResolvedValue(null)
    vi.mocked(repositorioDeEnderecosWms.criar).mockResolvedValue({
      id: 'end-1',
      codigo: 'A-RC-CH-20-2-05',
      ...componentesValidos,
      ativo: true,
      createdAt: new Date(),
    })

    const criado = await servicoDeEnderecosWms.criarEndereco(
      'company-001',
      { ...componentesValidos, ativo: true },
      'user-001'
    )
    expect(criado.codigo).toBe('A-RC-CH-20-2-05')

    vi.mocked(repositorioDeEnderecosWms.buscarPorCodigo).mockResolvedValue({
      id: 'end-1',
      codigo: 'A-RC-CH-20-2-05',
      ...componentesValidos,
      ativo: true,
      createdAt: new Date(),
    })

    await expect(
      servicoDeEnderecosWms.criarEndereco(
        'company-001',
        { ...componentesValidos, ativo: true },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Código de endereço já cadastrado nesta empresa',
      codigoHttp: 409,
    })
  })

  it('recusa letra na rua', async () => {
    await expect(
      servicoDeEnderecosWms.criarEndereco(
        'company-001',
        {
          local: 'A',
          area: 'RC',
          tipo: 'CH',
          rua: 'C',
          andar: '20',
          posicao: '2',
          ativo: true,
        },
        'user-001'
      )
    ).rejects.toBeInstanceOf(ErroDaAplicacao)

    await expect(
      servicoDeEnderecosWms.criarEndereco(
        'company-001',
        {
          local: 'A',
          area: 'RC',
          tipo: 'CH',
          rua: 'C',
          andar: '20',
          posicao: '2',
          ativo: true,
        },
        'user-001'
      )
    ).rejects.toThrow('Rua deve ter 2 números')
  })

  it('GET por id de outra empresa não encontra', async () => {
    vi.mocked(repositorioDeEnderecosWms.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeEnderecosWms.buscarPorId('company-outra', 'end-1')
    ).rejects.toMatchObject({
      message: 'Endereço WMS não encontrado',
      codigoHttp: 404,
    })
  })
})
