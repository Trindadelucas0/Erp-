import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('./repositorio-requisicoes-wms.js', () => ({
  repositorioDeRequisicoesWms: {
    usuarioDaEmpresa: vi.fn(),
    buscarPorNfeRecebida: vi.fn(),
    listarPorNfeRecebidaIds: vi.fn(),
    atualizar: vi.fn(),
    atualizarNoTx: vi.fn(),
    executarEmTransacao: vi.fn(),
    proximoNumero: vi.fn(),
  },
}))

import { repositorioDeRequisicoesWms } from './repositorio-requisicoes-wms.js'
import {
  criarOuReabrirOsContagemEntrada,
  exigirResponsavelDaEmpresa,
  gravarLiberacaoContagemComOs,
  reabrirOsContagemDaNota,
  concluirOsContagemDasNotas,
} from './os-contagem-entrada.js'

const agora = new Date()

function osRow(parcial: Record<string, unknown> = {}) {
  return {
    id: 'os-1',
    companyId: 'c1',
    numero: 7,
    tipoOperacao: 'contagem_entrada',
    prioridade: 3,
    status: 'concluida',
    nfeRecebidaId: 'nota-1',
    responsavelId: 'op-1',
    responsavel: { id: 'op-1', name: 'João' },
    createdAt: agora,
    ...parcial,
  }
}

describe('os-contagem-entrada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeRequisicoesWms.executarEmTransacao).mockImplementation(async (fn) =>
      fn({
        nfeRecebida: { update: vi.fn() },
        requisicaoWms: { create: vi.fn().mockResolvedValue(osRow({ status: 'atribuida' })) },
      } as never)
    )
    vi.mocked(repositorioDeRequisicoesWms.proximoNumero).mockResolvedValue(1)
    vi.mocked(repositorioDeRequisicoesWms.usuarioDaEmpresa).mockResolvedValue({
      id: 'op-1',
      name: 'João',
    })
  })

  it('recusa usuário de outra empresa', async () => {
    vi.mocked(repositorioDeRequisicoesWms.usuarioDaEmpresa).mockResolvedValue(null)
    await expect(exigirResponsavelDaEmpresa('c1', 'x')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('grava NF + OS na mesma transação', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorNfeRecebida).mockResolvedValue(null)
    await gravarLiberacaoContagemComOs({
      companyId: 'c1',
      notaId: 'nota-1',
      chaveNfe: '7'.repeat(44),
      responsavelId: 'op-1',
      usuarioId: 'admin-1',
      statusEntrada: 'entrada_contagem',
    })
    expect(repositorioDeRequisicoesWms.executarEmTransacao).toHaveBeenCalled()
    expect(repositorioDeRequisicoesWms.usuarioDaEmpresa).toHaveBeenCalledWith('c1', 'op-1')
  })

  it('reabre a mesma OS em vez de duplicar', async () => {
    const existente = osRow({ status: 'cancelada' })
    vi.mocked(repositorioDeRequisicoesWms.buscarPorNfeRecebida).mockResolvedValue(
      existente as never
    )
    vi.mocked(repositorioDeRequisicoesWms.atualizarNoTx).mockResolvedValue(
      osRow({ status: 'atribuida' }) as never
    )
    const tx = {
      nfeRecebida: { update: vi.fn() },
      requisicaoWms: { create: vi.fn() },
    }
    await criarOuReabrirOsContagemEntrada({
      companyId: 'c1',
      nfeRecebidaId: 'nota-1',
      chaveNfe: '7'.repeat(44),
      responsavelId: 'op-1',
      usuarioId: 'admin-1',
      tx: tx as never,
    })
    expect(tx.requisicaoWms.create).not.toHaveBeenCalled()
    expect(repositorioDeRequisicoesWms.atualizarNoTx).toHaveBeenCalledWith(
      tx,
      'c1',
      'os-1',
      expect.objectContaining({ status: 'atribuida', responsavelId: 'op-1' }),
      expect.objectContaining({ acao: 'atribuir' })
    )
  })

  it('voltar para contagem reabre a mesma OS atribuída', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorNfeRecebida).mockResolvedValue(
      osRow({ status: 'concluida', id: 'os-1' }) as never
    )
    vi.mocked(repositorioDeRequisicoesWms.atualizar).mockResolvedValue(
      osRow({ status: 'atribuida', id: 'os-1' }) as never
    )
    const r = await reabrirOsContagemDaNota({
      companyId: 'c1',
      nfeRecebidaId: 'nota-1',
      usuarioId: 'admin-1',
    })
    expect(r?.id).toBe('os-1')
    expect(repositorioDeRequisicoesWms.atualizar).toHaveBeenCalledWith(
      'c1',
      'os-1',
      expect.objectContaining({ status: 'atribuida' }),
      expect.objectContaining({ acao: 'atribuir' })
    )
  })

  it('concluir sessão conclui OS aberta', async () => {
    vi.mocked(repositorioDeRequisicoesWms.listarPorNfeRecebidaIds).mockResolvedValue([
      osRow({ status: 'em_execucao' }),
    ] as never)
    vi.mocked(repositorioDeRequisicoesWms.atualizar).mockResolvedValue(osRow() as never)
    await concluirOsContagemDasNotas({
      companyId: 'c1',
      nfeRecebidaIds: ['nota-1'],
      usuarioId: 'op-1',
    })
    expect(repositorioDeRequisicoesWms.atualizar).toHaveBeenCalledWith(
      'c1',
      'os-1',
      expect.objectContaining({ status: 'concluida' }),
      expect.objectContaining({ acao: 'concluir' })
    )
  })
})
