import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../compartilhado/utilitarios/token-jwt.js', () => ({ verificarTokenDeAutenticacao: vi.fn() }))
vi.mock('../../modulos/usuarios/repositorio-usuarios.js', () => ({ repositorioDeUsuarios: { buscarPorId: vi.fn() } }))
vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({ clientePrisma: {
  user: { findUnique: vi.fn() }, company: { findUnique: vi.fn() }, userCompany: { findUnique: vi.fn() },
} }))
vi.mock('./servico-regras-fiscais.js', () => ({ servicoRegrasFiscais: { obter: vi.fn(), gravar: vi.fn() } }))
import { verificarTokenDeAutenticacao } from '../../compartilhado/utilitarios/token-jwt.js'
import { repositorioDeUsuarios } from '../../modulos/usuarios/repositorio-usuarios.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { servicoRegrasFiscais } from './servico-regras-fiscais.js'
import { rotasDeConfiguracoes } from './rotas-configuracoes.js'
import { regrasFiscaisPadrao } from './esquema-regras-fiscais.js'

describe('rotas fiscais com autenticação e autorização reais', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(verificarTokenDeAutenticacao).mockResolvedValue({ idDoUsuario: 'u', tokenVersion: 1 } as never)
    vi.mocked(clientePrisma.user.findUnique).mockResolvedValue({ id: 'u', active: true, tokenVersion: 1 } as never)
    vi.mocked(clientePrisma.company.findUnique).mockResolvedValue({ id: 'a' } as never)
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue({ roles: [{ role: { name: 'admin' } }] } as never)
    vi.mocked(servicoRegrasFiscais.obter).mockResolvedValue(regrasFiscaisPadrao())
    vi.mocked(servicoRegrasFiscais.gravar).mockResolvedValue(regrasFiscaisPadrao())
  })
  async function requisitar(method: 'GET' | 'PUT', headers = { 'x-company-id': 'a' }, payload?: object) {
    const app = Fastify()
    await app.register(rotasDeConfiguracoes, { prefix: '/configuracoes' })
    try { return await app.inject({ method, url: '/configuracoes/regras-fiscais', headers, ...(payload ? { payload } : {}) }) }
    finally { await app.close() }
  }
  it.each(['GET', 'PUT'] as const)('recusa não administrador em %s', async (method) => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue({ roles: [{ role: { name: 'financeiro' } }] } as never)
    vi.mocked(clientePrisma.userCompany.findUnique).mockResolvedValue({ userId: 'u', companyId: 'a' } as never)
    expect((await requisitar(method, undefined, method === 'PUT' ? regrasFiscaisPadrao() : undefined)).statusCode).toBe(403)
    expect(servicoRegrasFiscais.obter).not.toHaveBeenCalled()
    expect(servicoRegrasFiscais.gravar).not.toHaveBeenCalled()
  })
  it('recusa sessão inválida e empresa ausente', async () => {
    vi.mocked(clientePrisma.user.findUnique).mockResolvedValue(null)
    expect((await requisitar('GET')).statusCode).toBe(401)
    vi.mocked(clientePrisma.user.findUnique).mockResolvedValue({ active: true, tokenVersion: 1 } as never)
    expect((await requisitar('GET', {} as never)).statusCode).toBe(400)
  })
  it('GET/PUT usa somente a empresa validada e rejeita companyId no corpo', async () => {
    expect((await requisitar('GET')).statusCode).toBe(200)
    expect(servicoRegrasFiscais.obter).toHaveBeenCalledWith('a')
    expect((await requisitar('PUT', undefined, regrasFiscaisPadrao())).statusCode).toBe(200)
    expect(servicoRegrasFiscais.gravar).toHaveBeenCalledWith('a', regrasFiscaisPadrao(), 'u')
    expect((await requisitar('PUT', undefined, { ...regrasFiscaisPadrao(), companyId: 'b' })).statusCode).toBe(400)
    expect(servicoRegrasFiscais.gravar).toHaveBeenCalledTimes(1)
  })
})
