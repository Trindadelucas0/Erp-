import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks declarados ANTES dos imports do módulo testado (hoisting)
vi.mock('../../../src/modulos/usuarios/repositorio-usuarios.js', () => ({
  repositorioDeUsuarios: {
    buscarPorEmail: vi.fn(),
    buscarPorId: vi.fn(),
  },
}))

vi.mock('../../../src/compartilhado/utilitarios/criptografia-senha.js', () => ({
  compararSenhaComHash: vi.fn(),
}))

vi.mock('../../../src/compartilhado/banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    user: { findUnique: vi.fn() },
  },
}))

vi.mock('../../../src/modulos/permissoes/repositorio-permissoes.js', () => ({
  repositorioDePermissoes: {
    buscarChavesDosPapeisPorIdDoUsuario: vi.fn().mockResolvedValue([]),
    buscarChavesExtrasPorIdDoUsuario: vi.fn().mockResolvedValue([]),
    buscarChavesPorIdDoUsuario: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../../../src/modulos/empresas/repositorio-empresas.js', () => ({
  repositorioDeEmpresas: {
    buscarPorIdDoUsuario: vi.fn().mockResolvedValue([]),
  },
}))

import { servicoDeAutenticacao } from '../../../src/modulos/autenticacao/servico-autenticacao.js'
import { repositorioDeUsuarios } from '../../../src/modulos/usuarios/repositorio-usuarios.js'
import { compararSenhaComHash } from '../../../src/compartilhado/utilitarios/criptografia-senha.js'
import { clientePrisma } from '../../../src/compartilhado/banco-dados/cliente-prisma.js'
import { ErroDaAplicacao } from '../../../src/compartilhado/erros/ErroDaAplicacao.js'

const usuarioAtivo = {
  id: 'user-001',
  name: 'Admin',
  email: 'admin@erp.local',
  password: '$hashed_password',
  active: true,
  tokenVersion: 0,
  roles: [{ role: { name: 'admin' } }],
  companies: [],
  paginasPermitidas: [],
  permissoesExtras: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('servicoDeAutenticacao.realizarLogin', () => {
  it('lança 401 quando email não existe', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue(null)

    await expect(
      servicoDeAutenticacao.realizarLogin({
        email: 'naoexiste@erp.local',
        senha: 'qualquer',
      })
    ).rejects.toThrow(ErroDaAplicacao)

    await expect(
      servicoDeAutenticacao.realizarLogin({
        email: 'naoexiste@erp.local',
        senha: 'qualquer',
      })
    ).rejects.toMatchObject({ codigoHttp: 401 })
  })

  it('lança 401 quando usuário está inativo', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue({
      ...usuarioAtivo,
      active: false,
    })

    await expect(
      servicoDeAutenticacao.realizarLogin({
        email: 'admin@erp.local',
        senha: 'admin123',
      })
    ).rejects.toMatchObject({ codigoHttp: 401 })
  })

  it('lança 401 quando senha está errada', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue(usuarioAtivo)
    vi.mocked(compararSenhaComHash).mockResolvedValue(false)

    await expect(
      servicoDeAutenticacao.realizarLogin({
        email: 'admin@erp.local',
        senha: 'senha_errada',
      })
    ).rejects.toMatchObject({ codigoHttp: 401 })
  })

  it('retorna idDoUsuario e tokenVersion no login correto', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue(usuarioAtivo)
    vi.mocked(compararSenhaComHash).mockResolvedValue(true)

    const resultado = await servicoDeAutenticacao.realizarLogin({
      email: 'admin@erp.local',
      senha: 'admin123',
    })

    expect(resultado.idDoUsuario).toBe('user-001')
    expect(resultado.tokenVersion).toBe(0)
  })

  it('a mensagem de erro não revela se é email ou senha (segurança)', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue(null)

    try {
      await servicoDeAutenticacao.realizarLogin({
        email: 'nao@existe.com',
        senha: 'qualquer',
      })
    } catch (erro) {
      expect((erro as ErroDaAplicacao).message).toContain('Email ou senha incorretos')
    }
  })
})

describe('servicoDeAutenticacao.verificarSenhaDoUsuario', () => {
  it('retorna false quando usuário não existe', async () => {
    vi.mocked(clientePrisma.user.findUnique).mockResolvedValue(null)

    const resultado = await servicoDeAutenticacao.verificarSenhaDoUsuario(
      'user-inexistente',
      'qualquer'
    )

    expect(resultado).toBe(false)
  })

  it('retorna false quando senha está errada', async () => {
    vi.mocked(clientePrisma.user.findUnique).mockResolvedValue({
      password: '$hashed',
    } as never)
    vi.mocked(compararSenhaComHash).mockResolvedValue(false)

    const resultado = await servicoDeAutenticacao.verificarSenhaDoUsuario(
      'user-001',
      'senha_errada'
    )

    expect(resultado).toBe(false)
  })

  it('retorna true quando senha está correta', async () => {
    vi.mocked(clientePrisma.user.findUnique).mockResolvedValue({
      password: '$hashed',
    } as never)
    vi.mocked(compararSenhaComHash).mockResolvedValue(true)

    const resultado = await servicoDeAutenticacao.verificarSenhaDoUsuario(
      'user-001',
      'senha_correta'
    )

    expect(resultado).toBe(true)
  })
})
