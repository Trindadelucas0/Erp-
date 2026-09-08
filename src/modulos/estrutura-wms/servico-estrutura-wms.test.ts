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
    excluir: vi.fn(),
    contarRuasDaArea: vi.fn(),
    garantirAreasETiposPadrao: vi.fn(),
    ehUnicidadePrisma: vi.fn(() => false),
  },
}))

vi.mock('../enderecos-wms/repositorio-enderecos-wms.js', () => ({
  repositorioDeEnderecosWms: {
    contarPorComponente: vi.fn(),
  },
}))

import { repositorioDeEstruturaWms } from './repositorio-estrutura-wms.js'
import { repositorioDeEnderecosWms } from '../enderecos-wms/repositorio-enderecos-wms.js'
import { servicoDeEstruturaWms } from './servico-estrutura-wms.js'

function itemRua(codigo: string, ativo = true, paiCodigo = 'RC') {
  return {
    id: `rua-${codigo}`,
    nivel: 'rua',
    codigo,
    nome: codigo,
    paiCodigo,
    ativo,
    createdAt: new Date(),
  }
}

function areaAtiva(codigo = 'RC') {
  return {
    id: `area-${codigo}`,
    nivel: 'area',
    codigo,
    nome: codigo,
    paiCodigo: null,
    ativo: true,
    createdAt: new Date(),
  }
}

function itemCatalogo(nivel: string, codigo: string, extra?: { ativo?: boolean; paiCodigo?: string | null }) {
  const paiCodigo =
    extra && 'paiCodigo' in extra
      ? (extra.paiCodigo ?? null)
      : nivel === 'rua'
        ? 'RC'
        : null
  return {
    id: `${nivel}-${codigo}`,
    nivel,
    codigo,
    nome: codigo,
    paiCodigo,
    ativo: extra?.ativo ?? true,
    createdAt: new Date(),
  }
}

describe('servicoDeEstruturaWms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeEstruturaWms.garantirAreasETiposPadrao).mockResolvedValue(undefined)
    vi.mocked(repositorioDeEstruturaWms.buscarPorNivelCodigo).mockImplementation(async (_c, nivel, codigo) => {
      if (nivel === 'area') return areaAtiva(codigo)
      return null
    })
  })

  it('cria quatro ruas e recusa a quinta com o mesmo código', async () => {
    vi.mocked(repositorioDeEstruturaWms.criar).mockImplementation(async (_c, dados) =>
      itemRua(dados.codigo)
    )

    for (const codigo of ['01', '02', '03', '04']) {
      const criado = await servicoDeEstruturaWms.criarNivel(
        'company-001',
        { nivel: 'rua', codigo, nome: '', paiCodigo: 'RC', ativo: true },
        'user-001'
      )
      expect(criado.codigo).toBe(codigo)
    }

    vi.mocked(repositorioDeEstruturaWms.ehUnicidadePrisma).mockReturnValue(true)
    vi.mocked(repositorioDeEstruturaWms.criar).mockRejectedValue({ code: 'P2002' })

    await expect(
      servicoDeEstruturaWms.criarNivel(
        'company-001',
        { nivel: 'rua', codigo: '01', nome: '', paiCodigo: 'RC', ativo: true },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Código já cadastrado neste nível da estrutura',
      codigoHttp: 409,
    })
  })

  it('grava o nome da rua igual ao código', async () => {
    vi.mocked(repositorioDeEstruturaWms.criar).mockImplementation(async (_c, dados) =>
      itemRua(dados.codigo, true, dados.paiCodigo ?? 'RC')
    )

    await servicoDeEstruturaWms.criarNivel(
      'company-001',
      { nivel: 'rua', codigo: '01', nome: 'Corredor', paiCodigo: 'RC', ativo: true },
      'user-001'
    )

    expect(repositorioDeEstruturaWms.criar).toHaveBeenCalledWith(
      'company-001',
      expect.objectContaining({ codigo: '01', nome: '01', paiCodigo: 'RC' })
    )
  })

  it('recusa rua sem área', async () => {
    await expect(
      servicoDeEstruturaWms.criarNivel(
        'company-001',
        { nivel: 'rua', codigo: '01', nome: '', ativo: true },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Rua deve estar vinculada a uma área',
      codigoHttp: 400,
    })
  })

  it('recusa código de local que não é letra', async () => {
    await expect(
      servicoDeEstruturaWms.criarNivel(
        'company-001',
        { nivel: 'local', codigo: '1', nome: 'Anexo', ativo: true },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Local deve ter 1 letra',
      codigoHttp: 400,
    })
  })

  it('recusa letra no código da rua', async () => {
    await expect(
      servicoDeEstruturaWms.criarNivel(
        'company-001',
        { nivel: 'rua', codigo: 'C', nome: '', paiCodigo: 'RC', ativo: true },
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
        return itemCatalogo(nivel, codigo)
      }
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo('company-001', {
        local: 'A',
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
      async (_c, nivel, codigo) =>
        itemCatalogo(nivel, codigo, { ativo: nivel !== 'rua', paiCodigo: nivel === 'rua' ? 'RC' : null })
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo('company-001', {
        local: 'A',
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

  it('recusa rua de outra área', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorNivelCodigo).mockImplementation(
      async (_c, nivel, codigo) =>
        itemCatalogo(nivel, codigo, { paiCodigo: nivel === 'rua' ? 'RC' : null })
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo('company-001', {
        local: 'A',
        area: 'EX',
        tipo: 'CH',
        rua: '20',
        andar: '2',
      })
    ).rejects.toMatchObject({
      message: 'Rua não pertence à área selecionada',
      codigoHttp: 400,
    })
  })

  it('recusa rua sem vínculo de área em endereço novo', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorNivelCodigo).mockImplementation(
      async (_c, nivel, codigo) =>
        itemCatalogo(nivel, codigo, { paiCodigo: nivel === 'rua' ? null : null })
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo('company-001', {
        local: 'A',
        area: 'RC',
        tipo: 'CH',
        rua: '20',
        andar: '2',
      })
    ).rejects.toMatchObject({
      message: 'Rua não pertence à área selecionada',
      codigoHttp: 400,
    })
  })

  it('aceita rua inativa se o endereço já gravado a usa', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorNivelCodigo).mockImplementation(
      async (_c, nivel, codigo) =>
        itemCatalogo(nivel, codigo, { ativo: nivel !== 'rua', paiCodigo: nivel === 'rua' ? 'RC' : null })
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo(
        'company-001',
        { local: 'A', area: 'RC', tipo: 'CH', rua: '20', andar: '2' },
        { local: 'A', area: 'RC', tipo: 'CH', rua: '20', andar: '2' }
      )
    ).resolves.toBeUndefined()
  })

  it('recusa local fora do catálogo', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorNivelCodigo).mockImplementation(
      async (_c, nivel, codigo) => {
        if (nivel === 'local') return null
        return itemCatalogo(nivel, codigo)
      }
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo('company-001', {
        local: 'C',
        area: 'RC',
        tipo: 'CH',
        rua: '20',
        andar: '2',
      })
    ).rejects.toMatchObject({
      message: 'Local não cadastrado na estrutura do depósito',
      codigoHttp: 400,
    })
  })

  it('aceita local inativo se o endereço já gravado o usa', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorNivelCodigo).mockImplementation(
      async (_c, nivel, codigo) =>
        itemCatalogo(nivel, codigo, {
          ativo: nivel !== 'local',
          paiCodigo: nivel === 'rua' ? 'RC' : null,
        })
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo(
        'company-001',
        { local: 'A', area: 'RC', tipo: 'CH', rua: '20', andar: '2' },
        { local: 'A', area: 'RC', tipo: 'CH', rua: '20', andar: '2' }
      )
    ).resolves.toBeUndefined()
  })

  it('recusa local inativo em endereço novo', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorNivelCodigo).mockImplementation(
      async (_c, nivel, codigo) =>
        itemCatalogo(nivel, codigo, {
          ativo: nivel !== 'local',
          paiCodigo: nivel === 'rua' ? 'RC' : null,
        })
    )

    await expect(
      servicoDeEstruturaWms.exigirNiveisDoCatalogo('company-001', {
        local: 'A',
        area: 'RC',
        tipo: 'CH',
        rua: '20',
        andar: '2',
      })
    ).rejects.toMatchObject({
      message: 'Local não cadastrado na estrutura do depósito',
      codigoHttp: 400,
    })
  })
})

describe('excluirNivel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeEstruturaWms.contarRuasDaArea).mockResolvedValue(0)
    vi.mocked(repositorioDeEnderecosWms.contarPorComponente).mockResolvedValue(0)
    vi.mocked(repositorioDeEstruturaWms.excluir).mockResolvedValue(true)
  })

  it('exclui local, área e tipo do seed quando não estão em uso', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(itemCatalogo('area', 'RC'))

    await servicoDeEstruturaWms.excluirNivel('company-001', 'area-RC', 'user-001')

    expect(repositorioDeEstruturaWms.excluir).toHaveBeenCalledWith('company-001', 'area-RC')
  })

  it('recusa excluir área que ainda tem rua', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(itemCatalogo('area', 'AM'))
    vi.mocked(repositorioDeEstruturaWms.contarRuasDaArea).mockResolvedValue(2)

    await expect(
      servicoDeEstruturaWms.excluirNivel('company-001', 'area-AM', 'user-001')
    ).rejects.toMatchObject({
      message: 'Há ruas cadastradas nesta área. Exclua as ruas primeiro.',
      codigoHttp: 409,
    })
  })

  it('recusa excluir nível usado em endereço', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(itemCatalogo('local', 'C'))
    vi.mocked(repositorioDeEnderecosWms.contarPorComponente).mockResolvedValue(1)

    await expect(
      servicoDeEstruturaWms.excluirNivel('company-001', 'local-C', 'user-001')
    ).rejects.toMatchObject({
      message: 'Há endereços WMS usando local C',
      codigoHttp: 409,
    })
  })

  it('exclui nível criado pelo operador quando não está em uso', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(itemCatalogo('local', 'C'))

    await servicoDeEstruturaWms.excluirNivel('company-001', 'local-C', 'user-001')

    expect(repositorioDeEstruturaWms.excluir).toHaveBeenCalledWith('company-001', 'local-C')
  })
})
