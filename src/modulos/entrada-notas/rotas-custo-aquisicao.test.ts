import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../compartilhado/utilitarios/token-jwt.js', () => ({ verificarTokenDeAutenticacao: vi.fn() }))
vi.mock('../usuarios/repositorio-usuarios.js', () => ({ repositorioDeUsuarios: { buscarPorId: vi.fn() } }))
vi.mock('../permissoes/repositorio-permissoes.js', () => ({ repositorioDePermissoes: { usuarioPossuiPermissao: vi.fn() } }))
vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({ clientePrisma: { user: { findUnique: vi.fn() }, company: { findUnique: vi.fn() }, userCompany: { findUnique: vi.fn() } } }))
vi.mock('../focus-nfe/repositorio-focus-nfe.js', () => ({ repositorioFocusNfe: { buscarPorId: vi.fn() } }))
vi.mock('./servico-acesso-painel-entrada.js', () => ({ exigirAcessoPainelEntradaNotas: vi.fn() }))
vi.mock('./servico-precificacao-entrada.js', () => ({ servicoPrecificacaoEntrada: { obterGrade: vi.fn(), gravarPrecos: vi.fn(), simular: vi.fn() } }))
import { verificarTokenDeAutenticacao } from '../../compartilhado/utilitarios/token-jwt.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { repositorioDeUsuarios } from '../usuarios/repositorio-usuarios.js'
import { repositorioDePermissoes } from '../permissoes/repositorio-permissoes.js'
import { repositorioFocusNfe } from '../focus-nfe/repositorio-focus-nfe.js'
import { servicoPrecificacaoEntrada as servico } from './servico-precificacao-entrada.js'
import { rotasEntradaNotas } from './rotas-entrada-notas.js'

const itemId = '878fce46-d22a-4dc5-8593-9ce3c1d71422'
describe('rotas de custo — sessão, empresa e produtos:edit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(verificarTokenDeAutenticacao).mockResolvedValue({ idDoUsuario: 'u', tokenVersion: 1 } as never)
    vi.mocked(clientePrisma.user.findUnique).mockResolvedValue({ id: 'u', active: true, tokenVersion: 1 } as never)
    vi.mocked(clientePrisma.company.findUnique).mockResolvedValue({ id: 'a' } as never)
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue({ roles: [{ role: { name: 'admin' } }] } as never)
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(true)
    vi.mocked(repositorioFocusNfe.buscarPorId).mockImplementation(async companyId => companyId === 'a' ? ({ statusEntrada: 'entrada_consolidada' } as never) : null)
    vi.mocked(servico.gravarPrecos).mockResolvedValue({ itens: [] } as never)
  })
  async function requisitar(method: 'GET' | 'PUT' | 'POST', rota: string, payload?: object, empresa = 'a') {
    const app = Fastify()
    app.setErrorHandler((erro, _request, reply) => reply.code('codigoHttp' in erro ? Number(erro.codigoHttp) : 500).send({ message: erro.message }))
    await app.register(rotasEntradaNotas, { prefix: '/entrada-notas' })
    try { return await app.inject({ method, url: `/entrada-notas/n/precificacao${rota ? `/${rota}` : ''}`, headers: { 'x-company-id': empresa }, ...(payload ? { payload } : {}) }) }
    finally { await app.close() }
  }
  it.each([['PUT', 'ajustes'], ['POST', 'confirmar-custo'], ['POST', 'ajustes/previa'], ['GET', 'memorias']] as const)('rota retirada %s %s retorna 404', async (metodo, rota) => {
    expect((await requisitar(metodo, rota)).statusCode).toBe(404)
  })
  it('grava diretamente com empresa da sessão e exige produtos:edit', async () => {
    const payload = { itens: [{ produtoId: itemId, precoVenda: 100 }] }
    expect((await requisitar('PUT', '', payload)).statusCode).toBe(200)
    expect(servico.gravarPrecos).toHaveBeenCalledWith('a', 'n', 'u', payload.itens, undefined)
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue({ roles: [{ role: { name: 'operador' } }] } as never)
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(false)
    expect((await requisitar('PUT', '', payload)).statusCode).toBe(403)
  })
  it('recusa outra empresa e sessão inválida', async () => {
    expect((await requisitar('PUT', '', { itens: [{ produtoId: itemId, precoVenda: 100 }] }, 'b')).statusCode).toBe(404)
    vi.mocked(clientePrisma.user.findUnique).mockResolvedValue(null)
    expect((await requisitar('GET', '')).statusCode).toBe(401)
    expect(servico.gravarPrecos).not.toHaveBeenCalled()
  })
  it('simulação exige sessão, empresa e permissão de editar produtos', async () => {
    const payload = { itemId, ajustes: {}, margemPercentual: 10, margemAtacado: null }
    vi.mocked(servico.simular).mockResolvedValue({ erro: null } as never)
    expect((await requisitar('POST', 'simular', payload)).statusCode).toBe(200)
    expect(servico.simular).toHaveBeenCalledWith('a', 'n', payload)
    expect((await requisitar('POST', 'simular', payload, 'b')).statusCode).toBe(404)
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue({ roles: [{ role: { name: 'operador' } }] } as never)
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(false)
    expect((await requisitar('POST', 'simular', payload)).statusCode).toBe(403)
    vi.mocked(clientePrisma.user.findUnique).mockResolvedValue(null)
    expect((await requisitar('POST', 'simular', payload)).statusCode).toBe(401)
  })
  it.each([{ freteValor: 2, fretePercentual: 2 }, { adicionalValor: 2, adicionalPercentual: 2 }, { descontoPercentual: 101 }, { tipoSt: 'outro' }, { precoTabela: -1 }])('recusa ajustes inválidos na fronteira HTTP: %j', async ajustes => {
    expect((await requisitar('POST', 'simular', { itemId, ajustes, margemPercentual: 0, margemAtacado: null })).statusCode).toBe(400)
    expect(servico.simular).not.toHaveBeenCalled()
  })

})
