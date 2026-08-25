import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./repositorio-contagens.js', () => ({
  repositorioContagens: {
    MSG_CONCORRENCIA: 'Outro operador alterou esta contagem. Recarregue.',
    buscarSessaoCompleta: vi.fn(),
    gravarRascunho: vi.fn(),
    finalizarSessaoOk: vi.fn(),
    finalizarSessaoDivergente: vi.fn(),
    atualizarQtdContadaComVersao: vi.fn(),
    cancelarSessao: vi.fn(),
  },
}))

import { repositorioContagens } from './repositorio-contagens.js'
import { servicoContagens } from './servico-contagens.js'

function sessaoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sessao-1',
    status: 'em_andamento',
    baixadaEm: null,
    versao: 3,
    observacao: null,
    iniciadoEm: new Date(),
    finalizadoEm: null,
    notas: [{ nfeRecebidaId: 'nota-1', nfeRecebida: { id: 'nota-1', chaveNfe: 'x'.repeat(44), nomeEmitente: 'F', documentoEmitente: null, dataEmissao: null, statusEntrada: 'entrada_contagem' } }],
    itens: [
      {
        id: 'item-1',
        produtoId: 'p1',
        nomeExibicao: 'Cimento 40kg',
        codigoBarras: null,
        codigoOriginal: null,
        marca: null,
        unidade: 'SC',
        qtdEmbalagemPadrao: 1,
        qtdEsperada: 10,
        qtdContada: 10,
        statusItem: 'pendente',
        produto: { id: 'p1', sku: '812', codigoBarras: null, embalagensMaster: [] },
      },
    ],
    revisoes: [],
    ...overrides,
  }
}

describe('gravar rascunho vs finalizar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioContagens.buscarSessaoCompleta).mockResolvedValue(sessaoBase() as never)
    vi.mocked(repositorioContagens.gravarRascunho).mockResolvedValue({ ok: true })
    vi.mocked(repositorioContagens.finalizarSessaoOk).mockResolvedValue({ ok: true })
    vi.mocked(repositorioContagens.finalizarSessaoDivergente).mockResolvedValue({ ok: true })
  })

  it('gravar não finaliza — chama gravarRascunho e mantém sessão editável no detalhe', async () => {
    const depois = sessaoBase({ versao: 4, revisoes: [{ id: 'r1', acao: 'gravar', observacao: null, itensJson: [], criadoEm: new Date(), usuario: { id: 'u1', name: 'Op' } }] })
    vi.mocked(repositorioContagens.buscarSessaoCompleta)
      .mockResolvedValueOnce(sessaoBase() as never)
      .mockResolvedValueOnce(depois as never)

    const r = await servicoContagens.gravar('c1', 'sessao-1', 'user-1', { versao: 3 })

    expect(repositorioContagens.gravarRascunho).toHaveBeenCalledWith(
      expect.objectContaining({
        sessaoId: 'sessao-1',
        versaoEsperada: 3,
        usuarioId: 'user-1',
      })
    )
    expect(repositorioContagens.finalizarSessaoOk).not.toHaveBeenCalled()
    expect(repositorioContagens.finalizarSessaoDivergente).not.toHaveBeenCalled()
    expect(r.ok).toBe(true)
    expect(r.sessao.status).toBe('em_andamento')
    expect(r.mensagem).toMatch(/continuar editando|Finalizar/i)
  })

  it('finalizar OK chama finalizarSessaoOk', async () => {
    const depois = sessaoBase({ status: 'ok', finalizadoEm: new Date(), versao: 4 })
    vi.mocked(repositorioContagens.buscarSessaoCompleta)
      .mockResolvedValueOnce(sessaoBase() as never)
      .mockResolvedValueOnce(depois as never)

    const r = await servicoContagens.finalizar('c1', 'sessao-1', 'user-1', { versao: 3 })

    expect(repositorioContagens.finalizarSessaoOk).toHaveBeenCalledWith(
      expect.objectContaining({
        sessaoId: 'sessao-1',
        nfeRecebidaIds: ['nota-1'],
        usuarioId: 'user-1',
      })
    )
    expect(r.ok).toBe(true)
    expect(r.sessao.status).toBe('ok')
  })

  it('finalizar com divergência sem confirmar só avisa', async () => {
    const divergente = sessaoBase({
      itens: [
        {
          id: 'item-1',
          produtoId: 'p1',
          nomeExibicao: 'Cimento 40kg',
          codigoBarras: null,
          codigoOriginal: null,
          marca: null,
          unidade: 'SC',
          qtdEmbalagemPadrao: 1,
          qtdEsperada: 10,
          qtdContada: 8,
          statusItem: 'pendente',
          produto: { id: 'p1', sku: '812', codigoBarras: null, embalagensMaster: [] },
        },
      ],
    })
    vi.mocked(repositorioContagens.buscarSessaoCompleta).mockResolvedValue(divergente as never)

    const r = await servicoContagens.finalizar('c1', 'sessao-1', 'user-1', {
      versao: 3,
      confirmarDivergencia: false,
    })

    expect(r.ok).toBe(false)
    expect(r.divergentes).toEqual(['Cimento 40kg'])
    expect(repositorioContagens.finalizarSessaoDivergente).not.toHaveBeenCalled()
  })

  it('versão stale em gravar retorna 409', async () => {
    vi.mocked(repositorioContagens.gravarRascunho).mockResolvedValue({
      ok: false,
      motivo: 'concorrencia',
    })

    await expect(
      servicoContagens.gravar('c1', 'sessao-1', 'user-1', { versao: 3 })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/Outro operador|Recarregue/),
    })
  })
})
