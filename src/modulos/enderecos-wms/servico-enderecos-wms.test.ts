import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn(),
}))

vi.mock('./repositorio-enderecos-wms.js', () => ({
  repositorioDeEnderecosWms: {
    buscarPorCodigoCompleto: vi.fn(),
    buscarPorCodigo: vi.fn(),
    buscarPorAndarCodigo: vi.fn(),
    buscarPorId: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    listarPorEmpresa: vi.fn(),
    listarPorAndar: vi.fn(),
    proximaSequencia: vi.fn(),
    excluir: vi.fn(),
    ehUnicidadePrisma: vi.fn(() => false),
  },
}))

vi.mock('./vinculo-produto-endereco-wms.js', () => ({
  contarProdutosNosCodigos: vi.fn(),
  MSG_PRODUTO_VINCULADO_ENDERECO:
    'Há produtos vinculados a este endereço. Realoque os produtos primeiro.',
  MSG_PRODUTO_VINCULADO_NIVEL:
    'Há produtos vinculados a endereços abaixo deste nível. Realoque os produtos primeiro.',
}))

vi.mock('../estrutura-wms/servico-estrutura-wms.js', () => ({
  servicoDeEstruturaWms: {
    buscarPorId: vi.fn(),
    statusEfetivoBloqueante: vi.fn(),
    caminhoComponentes: vi.fn(),
  },
}))

import { repositorioDeEnderecosWms } from './repositorio-enderecos-wms.js'
import { contarProdutosNosCodigos } from './vinculo-produto-endereco-wms.js'
import { servicoDeEstruturaWms } from '../estrutura-wms/servico-estrutura-wms.js'
import { servicoDeEnderecosWms } from './servico-enderecos-wms.js'

const caminho = {
  local: 'A',
  area: 'RC',
  rua: '20',
  bloco: '01',
  andar: '2',
  no: { id: 'andar-2', nivel: 'andar' },
  cadeia: [],
}

const apCriado = {
  id: 'end-1',
  andarId: 'andar-2',
  codigo: '05',
  codigoCompleto: 'A-RC-20-01-2-05',
  local: 'A',
  area: 'RC',
  rua: '20',
  bloco: '01',
  andar: '2',
  posicao: '05',
  tipoEndereco: 'CH',
  sequencia: 0,
  status: 'ativo',
  ativo: true,
  createdAt: new Date(),
}

describe('servicoDeEnderecosWms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(servicoDeEstruturaWms.buscarPorId).mockResolvedValue({
      id: 'andar-2',
      nivel: 'andar',
      codigo: '2',
      nome: '2',
      parentId: 'bloco-01',
      sequencia: 0,
      status: 'ativo',
      ativo: true,
      createdAt: new Date(),
    })
    vi.mocked(servicoDeEstruturaWms.statusEfetivoBloqueante).mockResolvedValue(null)
    vi.mocked(servicoDeEstruturaWms.caminhoComponentes).mockResolvedValue(caminho as never)
    vi.mocked(repositorioDeEnderecosWms.proximaSequencia).mockResolvedValue(0)
    vi.mocked(repositorioDeEnderecosWms.buscarPorAndarCodigo).mockResolvedValue(null)
    vi.mocked(contarProdutosNosCodigos).mockResolvedValue(0)
  })

  it('cria apartamento e recusa duplicata no mesmo andar', async () => {
    vi.mocked(repositorioDeEnderecosWms.criar).mockResolvedValue(apCriado)

    const criado = await servicoDeEnderecosWms.criarEndereco(
      'company-001',
      { andarId: 'andar-2', codigo: '05', tipoEndereco: 'CH', status: 'ativo' },
      'user-001'
    )
    expect(criado.codigoCompleto).toBe('A-RC-20-01-2-05')

    vi.mocked(repositorioDeEnderecosWms.buscarPorAndarCodigo).mockResolvedValue(apCriado)

    await expect(
      servicoDeEnderecosWms.criarEndereco(
        'company-001',
        { andarId: 'andar-2', codigo: '05', tipoEndereco: 'CH', status: 'ativo' },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Já existe um apartamento 05 neste andar.',
      codigoHttp: 409,
    })
  })

  it('recusa letra no apartamento', async () => {
    await expect(
      servicoDeEnderecosWms.criarEndereco(
        'company-001',
        { andarId: 'andar-2', codigo: 'C', tipoEndereco: 'CH' },
        'user-001'
      )
    ).rejects.toBeInstanceOf(ErroDaAplicacao)
  })

  it('recusa criar sob ancestral bloqueado', async () => {
    vi.mocked(servicoDeEstruturaWms.statusEfetivoBloqueante).mockResolvedValue('bloco')
    await expect(
      servicoDeEnderecosWms.criarEndereco(
        'company-001',
        { andarId: 'andar-2', codigo: '05', tipoEndereco: 'CH' },
        'user-001'
      )
    ).rejects.toMatchObject({
      message: 'Este endereço está indisponível porque seu Bloco está bloqueado.',
      codigoHttp: 400,
    })
    expect(repositorioDeEnderecosWms.criar).not.toHaveBeenCalled()
  })

  it('GET por id de outra empresa não encontra', async () => {
    vi.mocked(repositorioDeEnderecosWms.buscarPorId).mockResolvedValue(null)
    await expect(servicoDeEnderecosWms.buscarPorId('company-outra', 'end-1')).rejects.toMatchObject({
      message: 'Endereço WMS não encontrado',
      codigoHttp: 404,
    })
  })

  it('exclui endereço da empresa', async () => {
    vi.mocked(repositorioDeEnderecosWms.buscarPorId).mockResolvedValue(apCriado)
    vi.mocked(repositorioDeEnderecosWms.excluir).mockResolvedValue(true)
    await servicoDeEnderecosWms.excluirEndereco('company-001', 'end-1', 'user-001')
    expect(repositorioDeEnderecosWms.excluir).toHaveBeenCalledWith('company-001', 'end-1')
  })

  it('recusa excluir endereço com produto vinculado', async () => {
    vi.mocked(repositorioDeEnderecosWms.buscarPorId).mockResolvedValue(apCriado)
    vi.mocked(contarProdutosNosCodigos).mockResolvedValue(3)
    await expect(
      servicoDeEnderecosWms.excluirEndereco('company-001', 'end-1', 'user-001')
    ).rejects.toMatchObject({
      message: 'Há produtos vinculados a este endereço. Realoque os produtos primeiro.',
      codigoHttp: 409,
    })
    expect(repositorioDeEnderecosWms.excluir).not.toHaveBeenCalled()
  })

  it('lista com teto quando filtra por q sem andar', async () => {
    vi.mocked(repositorioDeEnderecosWms.listarPorEmpresa).mockResolvedValue([apCriado])
    await servicoDeEnderecosWms.listar('company-001', { q: 'RC 20' })
    expect(repositorioDeEnderecosWms.listarPorEmpresa).toHaveBeenCalledWith(
      'company-001',
      expect.objectContaining({ q: 'RC 20', take: 80 })
    )
  })

  it('lista sem teto quando filtra por andar', async () => {
    vi.mocked(repositorioDeEnderecosWms.listarPorEmpresa).mockResolvedValue([apCriado])
    await servicoDeEnderecosWms.listar('company-001', { andarId: 'andar-2', q: '05', take: 10 })
    expect(repositorioDeEnderecosWms.listarPorEmpresa).toHaveBeenCalledWith(
      'company-001',
      expect.objectContaining({ andarId: 'andar-2', take: undefined })
    )
  })
})
