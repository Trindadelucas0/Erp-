import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn(),
}))

vi.mock('./repositorio-estrutura-wms.js', () => ({
  repositorioDeEstruturaWms: {
    listarPorEmpresa: vi.fn(),
    buscarPorId: vi.fn(),
    buscarFilhoPorCodigo: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    excluir: vi.fn(),
    contarFilhos: vi.fn(),
    proximaSequencia: vi.fn(),
    garantirCatalogoPadrao: vi.fn(),
    garantirAreasETiposPadrao: vi.fn(),
    coletarIdsSubarvore: vi.fn(),
    ancestrais: vi.fn(),
    excluirSubarvore: vi.fn(),
    ehUnicidadePrisma: vi.fn(() => false),
  },
}))

vi.mock('../enderecos-wms/repositorio-enderecos-wms.js', () => ({
  repositorioDeEnderecosWms: {
    contarPorAndar: vi.fn(),
    contarPorAndares: vi.fn(),
    listarPorAndares: vi.fn(),
    atualizarCodigoCompletoEmLote: vi.fn(),
    buscarPorAndarCodigo: vi.fn(),
    proximaSequencia: vi.fn(),
    criar: vi.fn(),
  },
}))

vi.mock('../enderecos-wms/vinculo-produto-endereco-wms.js', () => ({
  contarProdutosNosCodigos: vi.fn(),
  MSG_PRODUTO_VINCULADO_ENDERECO:
    'Há produtos vinculados a este endereço. Realoque os produtos primeiro.',
  MSG_PRODUTO_VINCULADO_NIVEL:
    'Há produtos vinculados a endereços abaixo deste nível. Realoque os produtos primeiro.',
}))

import { repositorioDeEstruturaWms } from './repositorio-estrutura-wms.js'
import { repositorioDeEnderecosWms } from '../enderecos-wms/repositorio-enderecos-wms.js'
import { contarProdutosNosCodigos } from '../enderecos-wms/vinculo-produto-endereco-wms.js'
import { servicoDeEstruturaWms } from './servico-estrutura-wms.js'

function no(nivel: string, codigo: string, extra?: Partial<{ id: string; parentId: string | null; status: string }>) {
  return {
    id: extra?.id ?? `${nivel}-${codigo}`,
    nivel,
    codigo,
    nome: codigo,
    parentId: extra?.parentId ?? null,
    sequencia: 0,
    status: extra?.status ?? 'ativo',
    ativo: (extra?.status ?? 'ativo') !== 'inativo',
    createdAt: new Date(),
  }
}

describe('servicoDeEstruturaWms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeEstruturaWms.garantirCatalogoPadrao).mockResolvedValue(undefined)
    vi.mocked(repositorioDeEstruturaWms.proximaSequencia).mockResolvedValue(0)
    vi.mocked(repositorioDeEstruturaWms.buscarFilhoPorCodigo).mockResolvedValue(null)
    vi.mocked(repositorioDeEstruturaWms.ancestrais).mockResolvedValue([])
  })

  it('cria ruas irmãs e recusa duplicata no mesmo pai', async () => {
    const area = no('area', 'RC', { id: 'area-RC', parentId: 'local-A' })
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(area)
    vi.mocked(repositorioDeEstruturaWms.criar).mockImplementation(async (_c, dados) =>
      no('rua', dados.codigo, { parentId: 'area-RC' })
    )

    for (const codigo of ['01', '02', '03', '04']) {
      const criado = await servicoDeEstruturaWms.criarNivel(
        'company-001',
        { codigo, nome: '', parentId: 'area-RC', status: 'ativo' },
        'user-001'
      )
      expect(criado.codigo).toBe(codigo)
    }

    vi.mocked(repositorioDeEstruturaWms.ehUnicidadePrisma).mockReturnValue(true)
    vi.mocked(repositorioDeEstruturaWms.criar).mockRejectedValue({ code: 'P2002' })

    await expect(
      servicoDeEstruturaWms.criarNivel(
        'company-001',
        { codigo: '01', nome: '', parentId: 'area-RC', status: 'ativo' },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Código já cadastrado neste nível da estrutura',
      codigoHttp: 409,
    })
  })

  it('recusa rua sem pai', async () => {
    await expect(
      servicoDeEstruturaWms.criarNivel(
        'company-001',
        { nivel: 'rua', codigo: '01', nome: '', ativo: true },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Informe o nível pai',
      codigoHttp: 400,
    })
  })

  it('recusa letra no código da rua', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(
      no('area', 'RC', { id: 'area-RC' })
    )
    await expect(
      servicoDeEstruturaWms.criarNivel(
        'company-001',
        { codigo: 'C', nome: '', parentId: 'area-RC', ativo: true },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Rua deve ter números (ex.: 01)',
      codigoHttp: 400,
    })
  })

  it('GET por id de outra empresa não encontra', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(null)
    await expect(servicoDeEstruturaWms.buscarPorId('company-outra', 'n-1')).rejects.toMatchObject({
      message: 'Item da estrutura WMS não encontrado',
      codigoHttp: 404,
    })
  })

  it('recusa criar filho sob nível bloqueado', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(
      no('bloco', '01', { id: 'bloco-01', parentId: 'rua-20', status: 'bloqueado' })
    )
    await expect(
      servicoDeEstruturaWms.criarNivel(
        'company-001',
        { codigo: '2', parentId: 'bloco-01' },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Este endereço está indisponível porque seu Bloco está bloqueado.',
      codigoHttp: 400,
    })
  })
})

describe('excluirNivel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contarProdutosNosCodigos).mockResolvedValue(0)
    vi.mocked(repositorioDeEnderecosWms.listarPorAndares).mockResolvedValue([])
    vi.mocked(repositorioDeEstruturaWms.excluirSubarvore).mockResolvedValue(undefined)
  })

  it('exclui área sem filhos', async () => {
    const area = no('area', 'RC')
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(area)
    vi.mocked(repositorioDeEstruturaWms.coletarIdsSubarvore).mockResolvedValue(['area-RC'])
    vi.mocked(repositorioDeEstruturaWms.listarPorEmpresa).mockResolvedValue([area])
    await servicoDeEstruturaWms.excluirNivel('company-001', 'area-RC', 'user-001')
    expect(repositorioDeEstruturaWms.excluirSubarvore).toHaveBeenCalledWith(
      'company-001',
      [area],
      []
    )
  })

  it('apaga subárvore vazia de produtos mesmo com filhos e apartamentos', async () => {
    const area = no('area', 'AM', { id: 'area-AM' })
    const rua = no('rua', '20', { id: 'rua-20', parentId: 'area-AM' })
    const bloco = no('bloco', '01', { id: 'bloco-01', parentId: 'rua-20' })
    const andar = no('andar', '2', { id: 'andar-2', parentId: 'bloco-01' })
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(area)
    vi.mocked(repositorioDeEstruturaWms.coletarIdsSubarvore).mockResolvedValue([
      'area-AM',
      'rua-20',
      'bloco-01',
      'andar-2',
    ])
    vi.mocked(repositorioDeEstruturaWms.listarPorEmpresa).mockResolvedValue([
      area,
      rua,
      bloco,
      andar,
    ])
    vi.mocked(repositorioDeEnderecosWms.listarPorAndares).mockResolvedValue([
      { codigoCompleto: 'A-AM-20-01-2-05' },
    ] as never)
    await servicoDeEstruturaWms.excluirNivel('company-001', 'area-AM', 'user-001')
    expect(repositorioDeEstruturaWms.excluirSubarvore).toHaveBeenCalledWith(
      'company-001',
      [area, rua, bloco, andar],
      ['andar-2']
    )
  })

  it('recusa excluir nível com produto nos apartamentos abaixo', async () => {
    const andar = no('andar', '2', { id: 'andar-2' })
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockResolvedValue(andar)
    vi.mocked(repositorioDeEstruturaWms.coletarIdsSubarvore).mockResolvedValue(['andar-2'])
    vi.mocked(repositorioDeEstruturaWms.listarPorEmpresa).mockResolvedValue([andar])
    vi.mocked(repositorioDeEnderecosWms.listarPorAndares).mockResolvedValue([
      { codigoCompleto: 'A-RC-20-01-2-05' },
    ] as never)
    vi.mocked(contarProdutosNosCodigos).mockResolvedValue(1)
    await expect(
      servicoDeEstruturaWms.excluirNivel('company-001', 'andar-2', 'user-001')
    ).rejects.toMatchObject({
      message: 'Há produtos vinculados a endereços abaixo deste nível. Realoque os produtos primeiro.',
      codigoHttp: 409,
    })
    expect(repositorioDeEstruturaWms.excluirSubarvore).not.toHaveBeenCalled()
  })
})

describe('previewGerar', () => {
  it('recusa quando a área não pertence ao local', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockImplementation(async (_c, id) => {
      if (id === 'local-A') return no('local', 'A', { id: 'local-A' })
      return no('area', 'RC', { id: 'area-RC', parentId: 'outro' })
    })
    await expect(
      servicoDeEstruturaWms.previewGerar('company-001', {
        localId: 'local-A',
        areaId: 'area-RC',
        blocoInicio: '01',
        blocoFim: '01',
        andarInicio: '1',
        andarFim: '1',
        apartamentoInicio: '01',
        apartamentoFim: '01',
        tipoPadrao: 'CH',
        ruaInicio: '01',
        ruaFim: '01',
      })
    ).rejects.toMatchObject({
      message: 'Área não pertence ao local selecionado',
      codigoHttp: 400,
    })
  })

  it('monta prévia com códigos de local e área ainda não persistidos', async () => {
    vi.mocked(repositorioDeEstruturaWms.buscarFilhoPorCodigo).mockResolvedValue(null)
    const preview = await servicoDeEstruturaWms.previewGerar('company-001', {
      localCodigo: 'A',
      areaCodigo: 'RC',
      blocoInicio: '01',
      blocoFim: '01',
      andarInicio: '2',
      andarFim: '2',
      apartamentoInicio: '05',
      apartamentoFim: '05',
      tipoPadrao: 'CH',
      ruaInicio: '20',
      ruaFim: '20',
    })
    expect(preview.total).toBe(1)
    expect(preview.exemplos).toEqual(['A-RC-20-01-2-05'])
    expect(repositorioDeEstruturaWms.criar).not.toHaveBeenCalled()
  })
})

describe('gerarEstrutura', () => {
  it('cria local e área novos e devolve ids para expandir', async () => {
    const local = no('local', 'C', { id: 'local-C' })
    const area = no('area', 'EXP', { id: 'area-EXP', parentId: 'local-C' })
    const rua = no('rua', '01', { id: 'rua-01', parentId: 'area-EXP' })
    const bloco = no('bloco', '01', { id: 'bloco-01', parentId: 'rua-01' })
    const andar = no('andar', '1', { id: 'andar-1', parentId: 'bloco-01' })
    vi.mocked(repositorioDeEstruturaWms.buscarFilhoPorCodigo).mockResolvedValue(null)
    vi.mocked(repositorioDeEstruturaWms.criar).mockImplementation(async (_c, dados) => {
      if (dados.nivel === 'local') return local
      if (dados.nivel === 'area') return area
      if (dados.nivel === 'rua') return rua
      if (dados.nivel === 'bloco') return bloco
      return andar
    })
    vi.mocked(repositorioDeEstruturaWms.buscarPorId).mockImplementation(async (_c, id) => {
      const mapa: Record<string, ReturnType<typeof no>> = {
        'local-C': local,
        'area-EXP': area,
        'rua-01': rua,
        'bloco-01': bloco,
        'andar-1': andar,
      }
      return mapa[id] ?? null
    })
    vi.mocked(repositorioDeEstruturaWms.ancestrais).mockResolvedValue([bloco, rua, area, local])
    vi.mocked(repositorioDeEnderecosWms.buscarPorAndarCodigo).mockResolvedValue(null)
    vi.mocked(repositorioDeEnderecosWms.proximaSequencia).mockResolvedValue(0)
    vi.mocked(repositorioDeEnderecosWms.criar).mockResolvedValue({ id: 'ap-1' } as never)

    const gerado = await servicoDeEstruturaWms.gerarEstrutura(
      'company-001',
      {
        localCodigo: 'C',
        areaCodigo: 'EXP',
        blocoInicio: '01',
        blocoFim: '01',
        andarInicio: '1',
        andarFim: '1',
        apartamentoInicio: '01',
        apartamentoFim: '01',
        tipoPadrao: 'CH',
        ruaInicio: '01',
        ruaFim: '01',
      },
      'user-001'
    )

    expect(gerado.criados).toBe(1)
    expect(gerado.pulados).toBe(0)
    expect(gerado.andarIds).toEqual(['andar-1'])
    expect(gerado.idsParaExpandir).toEqual(
      expect.arrayContaining(['local-C', 'area-EXP', 'rua-01', 'bloco-01', 'andar-1'])
    )
    expect(repositorioDeEnderecosWms.criar).toHaveBeenCalled()
  })
})
