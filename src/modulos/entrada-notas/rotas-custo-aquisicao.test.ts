import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../compartilhado/utilitarios/token-jwt.js', () => ({ verificarTokenDeAutenticacao: vi.fn() }))
vi.mock('../usuarios/repositorio-usuarios.js', () => ({ repositorioDeUsuarios: { buscarPorId: vi.fn() } }))
vi.mock('../permissoes/repositorio-permissoes.js', () => ({ repositorioDePermissoes: { usuarioPossuiPermissao: vi.fn() } }))
vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({ clientePrisma: { user: { findUnique: vi.fn() }, company: { findUnique: vi.fn() }, userCompany: { findUnique: vi.fn() } } }))
vi.mock('../focus-nfe/repositorio-focus-nfe.js', () => ({ repositorioFocusNfe: { buscarPorId: vi.fn() } }))
vi.mock('./servico-acesso-painel-entrada.js', () => ({ exigirAcessoPainelEntradaNotas: vi.fn() }))
vi.mock('./servico-precificacao-entrada.js', () => ({ servicoPrecificacaoEntrada: { obterGrade: vi.fn(), salvarAjustes: vi.fn(), confirmarCusto: vi.fn(), listarMemorias: vi.fn(), simularAjustes: vi.fn(), gravarPrecos: vi.fn() } }))
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
    for (const metodo of ['salvarAjustes', 'confirmarCusto', 'simularAjustes', 'listarMemorias'] as const) vi.mocked(servico[metodo]).mockResolvedValue({ itens: [] } as never)
  })
  async function requisitar(method: 'GET' | 'PUT' | 'POST', rota: string, payload?: object, empresa = 'a') {
    const app = Fastify()
    await app.register(rotasEntradaNotas, { prefix: '/entrada-notas' })
    try { return await app.inject({ method, url: `/entrada-notas/n/precificacao/${rota}`, headers: { 'x-company-id': empresa }, ...(payload ? { payload } : {}) }) }
    finally { await app.close() }
  }
  const ajustes = { revisao: 'r', ajustes: { decisaoFrete: null, bases: [], despesas: [] } }
  const confirmar = { revisao: 'r', itemIds: [itemId] }
  it.each([['PUT', 'ajustes', ajustes], ['POST', 'confirmar-custo', confirmar], ['POST', 'ajustes/previa', ajustes]] as const)('recusa %s %s sem produtos:edit', async (metodo, rota, payload) => {
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(false)
    expect((await requisitar(metodo, rota, payload)).statusCode).toBe(403)
    expect(servico.salvarAjustes).not.toHaveBeenCalled(); expect(servico.confirmarCusto).not.toHaveBeenCalled()
  })
  it('consulta memória sem editar e usa a empresa e usuário da sessão para confirmar', async () => {
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(false)
    expect((await requisitar('GET', 'memorias')).statusCode).toBe(200)
    expect(servico.listarMemorias).toHaveBeenCalledWith('a', 'n')
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(true)
    expect((await requisitar('POST', 'confirmar-custo', confirmar)).statusCode).toBe(200)
    expect(servico.confirmarCusto).toHaveBeenCalledWith('a', 'n', 'u', 'r', [itemId])
  })
  it('recusa outra empresa, sessão inválida e tentativa de enviar empresa no corpo', async () => {
    expect((await requisitar('GET', 'memorias', undefined, 'b')).statusCode).toBe(404)
    expect((await requisitar('PUT', 'ajustes', { ...ajustes, companyId: 'b' })).statusCode).toBe(400)
    vi.mocked(clientePrisma.user.findUnique).mockResolvedValue(null)
    expect((await requisitar('GET', 'memorias')).statusCode).toBe(401)
  })
})
