import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-requisicoes-wms.js', () => ({
  repositorioDeRequisicoesWms: {
    buscarArmazenagemPorNfeProduto: vi.fn(),
    listarEnderecosCadastroProduto: vi.fn(),
    listarEnderecosWmsOperacionais: vi.fn(),
    executarEmTransacao: vi.fn(),
    proximoNumero: vi.fn(),
  },
}))

import { repositorioDeRequisicoesWms } from './repositorio-requisicoes-wms.js'
import {
  agruparLinhasArmazenagem,
  gerarOsArmazenagemAposConsolidar,
  observacaoOsArmazenagem,
  resolverDestinoArmazenagem,
  TIPO_OS_ARMAZENAGEM,
} from './os-armazenagem-entrada.js'

describe('os-armazenagem-entrada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeRequisicoesWms.executarEmTransacao).mockImplementation(async (fn) =>
      fn({
        requisicaoWms: { create: vi.fn().mockResolvedValue({ id: 'os-a1', produtoId: 'p1' }) },
      } as never)
    )
    vi.mocked(repositorioDeRequisicoesWms.proximoNumero).mockResolvedValue(12)
    vi.mocked(repositorioDeRequisicoesWms.buscarArmazenagemPorNfeProduto).mockResolvedValue(null)
    vi.mocked(repositorioDeRequisicoesWms.listarEnderecosCadastroProduto).mockResolvedValue([
      { endereco: 'A-RC-20-01-2-05', ordem: 0 },
    ])
    vi.mocked(repositorioDeRequisicoesWms.listarEnderecosWmsOperacionais).mockResolvedValue([
      { id: 'end-1', codigoCompleto: 'A-RC-20-01-2-05', ativo: true, status: 'ativo' },
    ])
  })

  it('agrupa quantidade por SKU', () => {
    expect(
      agruparLinhasArmazenagem([
        { produtoId: 'p1', quantidadeEstoque: 2 },
        { produtoId: 'p1', quantidadeEstoque: 3 },
        { produtoId: 'p2', quantidadeEstoque: 1 },
      ])
    ).toEqual([
      { produtoId: 'p1', quantidade: 5 },
      { produtoId: 'p2', quantidade: 1 },
    ])
  })

  it('destino = 1º cadastro que casa com AP ativo', () => {
    const id = resolverDestinoArmazenagem(
      [
        { endereco: 'X-INATIVO', ordem: 0 },
        { endereco: 'A-RC-20-01-2-05', ordem: 1 },
      ],
      [
        { id: 'off', codigoCompleto: 'X-INATIVO', ativo: false, status: 'inativo' },
        { id: 'ok', codigoCompleto: 'A-RC-20-01-2-05', ativo: true, status: 'ativo' },
      ]
    )
    expect(id).toBe('ok')
  })

  it('sem endereço WMS ativo não inventa AP', () => {
    expect(
      resolverDestinoArmazenagem(
        [{ endereco: 'A-RC-20-01-2-05', ordem: 0 }],
        [{ id: 'off', codigoCompleto: 'A-RC-20-01-2-05', ativo: true, status: 'bloqueado' }]
      )
    ).toBeNull()
  })

  it('gera OS no consolidar revenda', async () => {
    const criadas = await gerarOsArmazenagemAposConsolidar({
      companyId: 'c1',
      nfeRecebidaId: 'nota-1',
      chaveNfe: '7'.repeat(44),
      usuarioId: 'u1',
      linhas: [{ produtoId: 'p1', quantidadeEstoque: 10 }],
    })
    expect(criadas).toHaveLength(1)
    expect(repositorioDeRequisicoesWms.executarEmTransacao).toHaveBeenCalled()
    expect(observacaoOsArmazenagem('7'.repeat(44))).toContain('Guardar mercadorias')
    expect(TIPO_OS_ARMAZENAGEM).toBe('armazenagem')
  })

  it('não duplica OS do mesmo company+nfe+produto', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarArmazenagemPorNfeProduto).mockResolvedValue({
      id: 'os-existente',
      status: 'disponivel',
      produtoId: 'p1',
    } as never)
    const tx = {
      requisicaoWms: { create: vi.fn() },
    }
    const criadas = await gerarOsArmazenagemAposConsolidar({
      companyId: 'c1',
      nfeRecebidaId: 'nota-1',
      chaveNfe: '7'.repeat(44),
      usuarioId: 'u1',
      linhas: [{ produtoId: 'p1', quantidadeEstoque: 10 }],
      tx: tx as never,
    })
    expect(criadas).toEqual([])
    expect(tx.requisicaoWms.create).not.toHaveBeenCalled()
  })

  it('cria linha visível mesmo sem destino (não inventa AP)', async () => {
    vi.mocked(repositorioDeRequisicoesWms.listarEnderecosCadastroProduto).mockResolvedValue([])
    const tx = {
      requisicaoWms: {
        create: vi.fn().mockResolvedValue({ id: 'os-a1', produtoId: 'p1' }),
      },
    }
    await gerarOsArmazenagemAposConsolidar({
      companyId: 'c1',
      nfeRecebidaId: 'nota-1',
      chaveNfe: '7'.repeat(44),
      usuarioId: 'u1',
      linhas: [{ produtoId: 'p1', quantidadeEstoque: 4 }],
      tx: tx as never,
    })
    expect(tx.requisicaoWms.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoOperacao: 'armazenagem',
          status: 'disponivel',
          origemEnderecoId: null,
          destinoEnderecoId: null,
          produtoId: 'p1',
          quantidade: 4,
          responsavelId: null,
        }),
      })
    )
  })
})
