import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn(),
}))

vi.mock('./repositorio-estrutura-wms.js', () => ({
  repositorioDeEstruturaWms: {
    listarPorEmpresa: vi.fn(),
    buscarPorId: vi.fn(),
    buscarPorNivelCodigo: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    garantirAreasETiposPadrao: vi.fn(),
    ehUnicidadePrisma: vi.fn(() => false),
  },
}))

import { repositorioDeEstruturaWms } from './repositorio-estrutura-wms.js'
import { servicoDeEstruturaWms } from './servico-estrutura-wms.js'

function itemRua(codigo: string, ativo = true) {
  return {
    id: `rua-${codigo}`,
    nivel: 'rua',
    codigo,
    nome: codigo,
    ativo,
    createdAt: new Date(),
  }
}

describe('servicoDeEstruturaWms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeEstruturaWms.garantirAreasETiposPadrao).mockResolvedValue(undefined)
  })

  it('cria quatro ruas e recusa a quinta com o mesmo código', async () => {
    vi.mocked(repositorioDeEstruturaWms.criar).mockImplementation(async (_c, dados) =>
      itemRua(dados.codigo)
    )

    for (const codigo of ['01', '02', '03', '04']) {
      const criado = await servicoDeEstruturaWms.criarNivel(
        'company-001',
        { nivel: 'rua', codigo, nome: '', ativo: true },
        'user-001'
      )
      expect(criado.codigo).toBe(codigo)
    }

    vi.mocked(repositorioDeEstruturaWms.ehUnicidadePrisma).mockReturnValue(true)
    vi.mocked(repositorioDeEstruturaWms.criar).mockRejectedValue({ code: 'P2002' })

    await expect(
      servicoDeEstruturaWms.criarNivel(
        'company-001',
        { nivel: 'rua', codigo: '01', nome: '', ativo: true },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Código já cadastrado neste nível da estrutura',
      codigoHttp: 409,
    })
  })

  it('recusa letra no código da rua', async () => {
    await expect(
      servicoDeEstruturaWms.criarNivel(
        'company-001',
        { nivel: 'rua', codigo: 'C', nome: '', ativo: true },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Rua deve ter 2 números (00 a 99)',
      codigoHttp: 400,
    })
  })

  it('GET por id de outra empresa não encontra', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeEstruturaWms.buscarPorId('company-outra', 'n-1')
    ).rejects.toMatchObject({
      message: 'Item da estrutura WMS não encontrado',
      codigoHttp: 404,
    })
  })
})

describe('exigirNiveisDoCatalogo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeEstruturaWms.garantirAreasETiposPadrao).mockResolvedValue(undefined)
  })

  it('recusa rua fora do catálogo', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorNivelCodigo).mockImplementation(
      async (_c, nivel, codigo) => {
        if (nivel === 'rua') return null
        return {
          id: `${nivel}-${codigo}`,
          nivel,
          codigo,
          nome: codigo,
          ativo: true,
          createdAt: new Date(),
        }
      }
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo('company-001', {
        area: 'RC',
        tipo: 'CH',
        rua: '20',
        andar: '2',
      })
    ).rejects.toMatchObject({
      message: 'Rua não cadastrada na estrutura do depósito',
      codigoHttp: 400,
    })
  })

  it('recusa rua inativa em endereço novo', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorNivelCodigo).mockImplementation(
      async (_c, nivel, codigo) => ({
        id: `${nivel}-${codigo}`,
        nivel,
        codigo,
        nome: codigo,
        ativo: nivel !== 'rua',
        createdAt: new Date(),
      })
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo('company-001', {
        area: 'RC',
        tipo: 'CH',
        rua: '20',
        andar: '2',
      })
    ).rejects.toMatchObject({
      message: 'Rua não cadastrada na estrutura do depósito',
      codigoHttp: 400,
    })
  })

  it('aceita rua inativa se o endereço já gravado a usa', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorNivelCodigo).mockImplementation(
      async (_c, nivel, codigo) => ({
        id: `${nivel}-${codigo}`,
        nivel,
        codigo,
        nome: codigo,
        ativo: nivel !== 'rua',
        createdAt: new Date(),
      })
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo(
        'company-001',
        { area: 'RC', tipo: 'CH', rua: '20', andar: '2' },
        { area: 'RC', tipo: 'CH', rua: '20', andar: '2' }
      )
    ).resolves.toBeUndefined()
  })
})
