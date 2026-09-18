import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../usuarios/repositorio-usuarios.js', () => ({
  repositorioDeUsuarios: {
    buscarPorId: vi.fn(),
  },
}))

vi.mock('../requisicoes-wms/os-contagem-entrada.js', () => ({
  listarResumoOsContagemPorNfeIds: vi.fn(),
  osContagemEstaAberta: (status: string) =>
    ['atribuida', 'em_execucao', 'pausada'].includes(status),
  concluirOsContagemDasNotas: vi.fn(),
}))

vi.mock('./repositorio-contagens.js', () => ({
  repositorioContagens: {
    notasEmSessaoAtiva: vi.fn(),
    buscarNotasParaSessao: vi.fn(),
    criarSessao: vi.fn(),
    buscarSessaoCompleta: vi.fn(),
    listarNomesUnidades: vi.fn().mockResolvedValue(new Map()),
  },
}))

import { repositorioDeUsuarios } from '../usuarios/repositorio-usuarios.js'
import { listarResumoOsContagemPorNfeIds } from '../requisicoes-wms/os-contagem-entrada.js'
import { repositorioContagens } from './repositorio-contagens.js'
import { servicoContagens } from './servico-contagens.js'

describe('POST /contagens — gate da OS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioContagens.notasEmSessaoAtiva).mockResolvedValue([])
    vi.mocked(repositorioContagens.buscarNotasParaSessao).mockResolvedValue([
      {
        id: 'nota-1',
        chaveNfe: '7'.repeat(44),
        statusEntrada: 'entrada_contagem',
        tipoDocumento: 'nfe55',
        fornecedorPessoaId: 'f1',
        itens: [
          {
            produtoId: 'p1',
            quantidade: 10,
            unidade: 'UN',
            produto: {
              nomeVenda: 'X',
              unidade: 'UN',
              codigoBarras: null,
              fornecedores: [],
              embalagensMaster: [],
            },
          },
        ],
      },
    ] as never)
  })

  it('operador que não é o dono recebe 403', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue({
      roles: [{ role: { name: 'estoque' } }],
    } as never)
    vi.mocked(listarResumoOsContagemPorNfeIds).mockResolvedValue(
      new Map([
        [
          'nota-1',
          {
            nfeRecebidaId: 'nota-1',
            requisicaoContagemId: 'os-1',
            requisicaoContagemNumero: 1,
            contagemResponsavelId: 'dono',
            contagemResponsavelNome: 'Dono',
            status: 'atribuida',
          },
        ],
      ])
    )

    await expect(servicoContagens.criar('c1', 'outro', ['nota-1'])).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(repositorioContagens.criarSessao).not.toHaveBeenCalled()
  })

  it('admin pode iniciar sessão de OS de outro', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue({
      roles: [{ role: { name: 'admin' } }],
    } as never)
    vi.mocked(listarResumoOsContagemPorNfeIds).mockResolvedValue(
      new Map([
        [
          'nota-1',
          {
            nfeRecebidaId: 'nota-1',
            requisicaoContagemId: 'os-1',
            requisicaoContagemNumero: 1,
            contagemResponsavelId: 'dono',
            contagemResponsavelNome: 'Dono',
            status: 'atribuida',
          },
        ],
      ])
    )
    vi.mocked(repositorioContagens.criarSessao).mockResolvedValue({ id: 'sessao-1' } as never)
    await expect(servicoContagens.criar('c1', 'admin-1', ['nota-1'])).rejects.toThrow()
    expect(repositorioContagens.criarSessao).toHaveBeenCalled()
  })
})
