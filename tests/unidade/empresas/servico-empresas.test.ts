import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/modulos/empresas/repositorio-empresas.js', () => ({
  repositorioDeEmpresas: {
    listarTodasAtivas: vi.fn(),
    buscarPorIdDoUsuario: vi.fn(),
    buscarPorId: vi.fn(),
    buscarPorCnpj: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    alterarStatus: vi.fn(),
  },
}))

vi.mock('../../../src/modulos/usuarios/repositorio-usuarios.js', () => ({
  repositorioDeUsuarios: {
    buscarPorId: vi.fn(),
  },
}))

vi.mock('../../../src/compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}))

import { servicoDeEmpresas } from '../../../src/modulos/empresas/servico-empresas.js'
import { repositorioDeEmpresas } from '../../../src/modulos/empresas/repositorio-empresas.js'
import { repositorioDeUsuarios } from '../../../src/modulos/usuarios/repositorio-usuarios.js'
import { ErroDaAplicacao } from '../../../src/compartilhado/erros/ErroDaAplicacao.js'

const empresaBase = {
  id: 'company-001',
  name: 'Alpha Ltda',
  cnpj: '11111111000191',
  active: true,
}

const usuarioAdmin = {
  id: 'user-admin',
  roles: [{ role: { name: 'admin' } }],
  companies: [],
}

const usuarioComum = {
  id: 'user-comum',
  roles: [{ role: { name: 'vendedor' } }],
  companies: [{ company: { id: 'company-001' } }],
}

const usuarioSemVinculo = {
  id: 'user-sem-vinculo',
  roles: [{ role: { name: 'vendedor' } }],
  companies: [], // não está vinculado à empresa
}

function dadosEmpresa(overrides = {}) {
  return {
    nome: 'Alpha Ltda',
    cnpj: '11111111000191',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('servicoDeEmpresas.criarEmpresa', () => {
  it('lança 400 quando CNPJ já está cadastrado', async () => {
    vi.mocked(repositorioDeEmpresas.buscarPorCnpj).mockResolvedValue(empresaBase)

    await expect(
      servicoDeEmpresas.criarEmpresa(dadosEmpresa(), 'autor-001')
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(
      servicoDeEmpresas.criarEmpresa(dadosEmpresa(), 'autor-001')
    ).rejects.toThrow('CNPJ já cadastrado')
  })

  it('cria empresa quando CNPJ é único', async () => {
    vi.mocked(repositorioDeEmpresas.buscarPorCnpj).mockResolvedValue(null)
    vi.mocked(repositorioDeEmpresas.criar).mockResolvedValue(empresaBase)

    const resultado = await servicoDeEmpresas.criarEmpresa(dadosEmpresa(), 'autor-001')
    expect(resultado.name).toBe('Alpha Ltda')
  })
})

describe('servicoDeEmpresas.editarEmpresa', () => {
  it('lança 404 quando usuário não existe', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeEmpresas.editarEmpresa('inexistente', 'company-001', dadosEmpresa())
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('lança 403 quando usuário não-admin não está vinculado à empresa', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(
      usuarioSemVinculo as never
    )

    await expect(
      servicoDeEmpresas.editarEmpresa('user-sem-vinculo', 'company-001', dadosEmpresa())
    ).rejects.toMatchObject({ codigoHttp: 403 })
  })

  it('lança 404 quando empresa não existe', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioAdmin as never)
    vi.mocked(repositorioDeEmpresas.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeEmpresas.editarEmpresa('user-admin', 'company-inexistente', dadosEmpresa())
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('lança 400 quando CNPJ já pertence a outra empresa', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioAdmin as never)
    vi.mocked(repositorioDeEmpresas.buscarPorId).mockResolvedValue(empresaBase)
    vi.mocked(repositorioDeEmpresas.buscarPorCnpj).mockResolvedValue({
      ...empresaBase,
      id: 'company-outra', // CNPJ em uso por empresa diferente
    })

    await expect(
      servicoDeEmpresas.editarEmpresa('user-admin', 'company-001', dadosEmpresa())
    ).rejects.toMatchObject({ codigoHttp: 400 })
  })

  it('admin pode editar qualquer empresa', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioAdmin as never)
    vi.mocked(repositorioDeEmpresas.buscarPorId).mockResolvedValue(empresaBase)
    vi.mocked(repositorioDeEmpresas.buscarPorCnpj).mockResolvedValue(null)
    vi.mocked(repositorioDeEmpresas.atualizar).mockResolvedValue({
      ...empresaBase,
      name: 'Alpha Editada',
    })

    const resultado = await servicoDeEmpresas.editarEmpresa(
      'user-admin',
      'company-001',
      dadosEmpresa({ nome: 'Alpha Editada' })
    )

    expect(resultado.name).toBe('Alpha Editada')
  })

  it('usuário vinculado pode editar sua empresa', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioComum as never)
    vi.mocked(repositorioDeEmpresas.buscarPorId).mockResolvedValue(empresaBase)
    vi.mocked(repositorioDeEmpresas.buscarPorCnpj).mockResolvedValue(null)
    vi.mocked(repositorioDeEmpresas.atualizar).mockResolvedValue(empresaBase)

    await expect(
      servicoDeEmpresas.editarEmpresa('user-comum', 'company-001', dadosEmpresa())
    ).resolves.toBeDefined()
  })
})

describe('servicoDeEmpresas.alterarStatusDaEmpresa', () => {
  it('lança 404 quando empresa não existe', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioAdmin as never)
    vi.mocked(repositorioDeEmpresas.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeEmpresas.alterarStatusDaEmpresa('user-admin', 'company-inexistente', false)
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('lança 403 quando usuário não vinculado tenta alterar status', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(
      usuarioSemVinculo as never
    )

    await expect(
      servicoDeEmpresas.alterarStatusDaEmpresa('user-sem-vinculo', 'company-001', false)
    ).rejects.toMatchObject({ codigoHttp: 403 })
  })
})

describe('servicoDeEmpresas.listarEmpresasParaUsuario', () => {
  it('lança 404 quando usuário não existe', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeEmpresas.listarEmpresasParaUsuario('inexistente')
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('admin recebe todas as empresas ativas', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioAdmin as never)
    vi.mocked(repositorioDeEmpresas.listarTodasAtivas).mockResolvedValue([
      empresaBase,
    ])

    const resultado = await servicoDeEmpresas.listarEmpresasParaUsuario('user-admin')
    expect(resultado).toHaveLength(1)
    expect(repositorioDeEmpresas.listarTodasAtivas).toHaveBeenCalled()
    expect(repositorioDeEmpresas.buscarPorIdDoUsuario).not.toHaveBeenCalled()
  })

  it('usuário comum recebe apenas empresas vinculadas', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioComum as never)
    vi.mocked(repositorioDeEmpresas.buscarPorIdDoUsuario).mockResolvedValue([empresaBase])

    const resultado = await servicoDeEmpresas.listarEmpresasParaUsuario('user-comum')
    expect(resultado).toHaveLength(1)
    expect(repositorioDeEmpresas.buscarPorIdDoUsuario).toHaveBeenCalledWith('user-comum')
    expect(repositorioDeEmpresas.listarTodasAtivas).not.toHaveBeenCalled()
  })
})
