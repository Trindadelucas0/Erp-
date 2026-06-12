import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/modulos/usuarios/repositorio-usuarios.js', () => ({
  repositorioDeUsuarios: {
    buscarPorEmail: vi.fn(),
    buscarPorId: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    alterarStatus: vi.fn(),
    atualizarSenha: vi.fn(),
    listarTodos: vi.fn(),
  },
}))

vi.mock('../../../src/compartilhado/utilitarios/criptografia-senha.js', () => ({
  criptografarSenha: vi.fn().mockResolvedValue('$hash_da_senha'),
}))

vi.mock('../../../src/compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}))

import { servicoDeUsuarios } from '../../../src/modulos/usuarios/servico-usuarios.js'
import { repositorioDeUsuarios } from '../../../src/modulos/usuarios/repositorio-usuarios.js'
import { ErroDaAplicacao } from '../../../src/compartilhado/erros/ErroDaAplicacao.js'

const usuarioBase = {
  id: 'user-001',
  name: 'João',
  email: 'joao@erp.local',
  active: true,
  roles: [],
  companies: [],
  paginasPermitidas: [],
  permissoesExtras: [],
}

function dadosCriarUsuario(overrides = {}) {
  return {
    nome: 'João Silva',
    email: 'joao@erp.local',
    senha: 'senha123',
    idsDosPapeis: ['role-001'],
    idsDasEmpresas: ['company-001'],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('servicoDeUsuarios.criarUsuario', () => {
  it('lança 400 quando email já está cadastrado', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue(usuarioBase)

    await expect(
      servicoDeUsuarios.criarUsuario(dadosCriarUsuario(), 'autor-001')
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(
      servicoDeUsuarios.criarUsuario(dadosCriarUsuario(), 'autor-001')
    ).rejects.toThrow('Email já cadastrado')
  })

  it('lança 400 quando chave de página é inválida', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue(null)

    await expect(
      servicoDeUsuarios.criarUsuario(
        dadosCriarUsuario({ chavesDasPaginasPermitidas: ['pagina-inexistente'] }),
        'autor-001'
      )
    ).rejects.toMatchObject({ codigoHttp: 400 })
  })

  it('aceita chaves de páginas válidas (cadastros, clientes)', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue(null)
    vi.mocked(repositorioDeUsuarios.criar).mockResolvedValue({
      ...usuarioBase,
      id: 'novo-user',
    } as never)

    await expect(
      servicoDeUsuarios.criarUsuario(
        dadosCriarUsuario({ chavesDasPaginasPermitidas: ['cadastros', 'clientes'] }),
        'autor-001'
      )
    ).resolves.toBeDefined()
  })

  it('cria usuário com senha criptografada (não salva texto puro)', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue(null)
    vi.mocked(repositorioDeUsuarios.criar).mockResolvedValue({
      ...usuarioBase,
      id: 'novo-user',
    } as never)

    await servicoDeUsuarios.criarUsuario(dadosCriarUsuario(), 'autor-001')

    expect(repositorioDeUsuarios.criar).toHaveBeenCalledWith(
      expect.objectContaining({ senhaCriptografada: '$hash_da_senha' })
    )
  })
})

describe('servicoDeUsuarios.editarUsuario', () => {
  it('lança 404 quando usuário não existe', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeUsuarios.editarUsuario('inexistente', dadosCriarUsuario(), 'autor-001')
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('lança 400 quando novo email pertence a outro usuário', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioBase)
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue({
      ...usuarioBase,
      id: 'outro-user-999', // email de outro usuário
    })

    await expect(
      servicoDeUsuarios.editarUsuario('user-001', dadosCriarUsuario(), 'autor-001')
    ).rejects.toMatchObject({ codigoHttp: 400 })
  })

  it('permite editar quando email novo não está em uso', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioBase)
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue(null)
    vi.mocked(repositorioDeUsuarios.atualizar).mockResolvedValue(usuarioBase as never)

    await expect(
      servicoDeUsuarios.editarUsuario('user-001', dadosCriarUsuario(), 'autor-001')
    ).resolves.toBeDefined()
  })

  it('permite editar quando o mesmo usuário mantém seu email', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioBase)
    vi.mocked(repositorioDeUsuarios.buscarPorEmail).mockResolvedValue(usuarioBase) // mesmo id
    vi.mocked(repositorioDeUsuarios.atualizar).mockResolvedValue(usuarioBase as never)

    await expect(
      servicoDeUsuarios.editarUsuario('user-001', dadosCriarUsuario(), 'autor-001')
    ).resolves.toBeDefined()
  })
})

describe('servicoDeUsuarios.alterarStatusDoUsuario', () => {
  it('lança 400 quando admin tenta desativar o próprio usuário', async () => {
    await expect(
      servicoDeUsuarios.alterarStatusDoUsuario('user-001', false, 'user-001')
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(
      servicoDeUsuarios.alterarStatusDoUsuario('user-001', false, 'user-001')
    ).rejects.toThrow('próprio usuário')
  })

  it('permite reativar o próprio usuário (ativo=true)', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioBase)
    vi.mocked(repositorioDeUsuarios.alterarStatus).mockResolvedValue(usuarioBase as never)

    await expect(
      servicoDeUsuarios.alterarStatusDoUsuario('user-001', true, 'user-001')
    ).resolves.toBeDefined()
  })

  it('lança 404 quando usuário alvo não existe', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeUsuarios.alterarStatusDoUsuario('inexistente', false, 'admin-001')
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('permite desativar outro usuário', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioBase)
    vi.mocked(repositorioDeUsuarios.alterarStatus).mockResolvedValue({
      ...usuarioBase,
      active: false,
    } as never)

    const resultado = await servicoDeUsuarios.alterarStatusDoUsuario(
      'user-001',
      false,
      'admin-999' // outro usuário aplicando
    )

    expect(resultado.active).toBe(false)
  })
})

describe('servicoDeUsuarios.resetarSenhaPorAdmin', () => {
  it('lança 404 quando usuário não existe', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeUsuarios.resetarSenhaPorAdmin('inexistente', 'nova123', 'admin-001')
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('salva senha criptografada', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue(usuarioBase)
    vi.mocked(repositorioDeUsuarios.atualizarSenha).mockResolvedValue(usuarioBase as never)

    await servicoDeUsuarios.resetarSenhaPorAdmin('user-001', 'novaSenha', 'admin-001')

    expect(repositorioDeUsuarios.atualizarSenha).toHaveBeenCalledWith(
      'user-001',
      '$hash_da_senha'
    )
  })
})
