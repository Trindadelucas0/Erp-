import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/modulos/papeis/repositorio-papeis.js', () => ({
  repositorioDePapeis: {
    listarTodos: vi.fn(),
    buscarPorId: vi.fn(),
    atualizarPermissoesDoPapel: vi.fn(),
    criar: vi.fn(),
    excluir: vi.fn(),
  },
}))

import { servicoDePapeis } from '../../../src/modulos/papeis/servico-papeis.js'
import { repositorioDePapeis } from '../../../src/modulos/papeis/repositorio-papeis.js'
import { ErroDaAplicacao } from '../../../src/compartilhado/erros/ErroDaAplicacao.js'

const papelAdmin = { id: 'role-admin', name: 'admin', permissions: [] }
const papelVendedor = { id: 'role-vendedor', name: 'vendedor', permissions: [] }
const papelCustom = { id: 'role-custom', name: 'supervisor', permissions: [] }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('servicoDePapeis.salvarPermissoesDoPapel', () => {
  it('lança 400 quando tenta editar o papel admin', async () => {
    vi.mocked(repositorioDePapeis.buscarPorId).mockResolvedValue(papelAdmin as never)

    await expect(
      servicoDePapeis.salvarPermissoesDoPapel('role-admin', ['perm-001'])
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(
      servicoDePapeis.salvarPermissoesDoPapel('role-admin', ['perm-001'])
    ).rejects.toThrow('admin')
  })

  it('lança 404 quando papel não existe', async () => {
    vi.mocked(repositorioDePapeis.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDePapeis.salvarPermissoesDoPapel('inexistente', [])
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('salva permissões de papel não-admin com sucesso', async () => {
    vi.mocked(repositorioDePapeis.buscarPorId).mockResolvedValue(papelVendedor as never)
    vi.mocked(repositorioDePapeis.atualizarPermissoesDoPapel).mockResolvedValue(
      papelVendedor as never
    )

    await expect(
      servicoDePapeis.salvarPermissoesDoPapel('role-vendedor', ['perm-001'])
    ).resolves.toBeDefined()
  })
})

describe('servicoDePapeis.criarPapel', () => {
  it('lança 400 quando tenta criar papel com nome admin', async () => {
    await expect(
      servicoDePapeis.criarPapel('admin')
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(servicoDePapeis.criarPapel('admin')).rejects.toThrow('reservado')
  })

  it('lança 400 quando papel com mesmo nome já existe', async () => {
    vi.mocked(repositorioDePapeis.listarTodos).mockResolvedValue([
      papelCustom,
    ] as never)

    await expect(
      servicoDePapeis.criarPapel('supervisor')
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(servicoDePapeis.criarPapel('supervisor')).rejects.toThrow(
      'Já existe um papel'
    )
  })

  it('cria papel quando nome é único e não reservado', async () => {
    vi.mocked(repositorioDePapeis.listarTodos).mockResolvedValue([] as never)
    vi.mocked(repositorioDePapeis.criar).mockResolvedValue({
      id: 'role-novo',
      name: 'gerente',
    } as never)

    const resultado = await servicoDePapeis.criarPapel('gerente', 'Papel gerente')
    expect(resultado.name).toBe('gerente')
  })
})

describe('servicoDePapeis.excluirPapel', () => {
  it('lança 400 quando tenta excluir o papel admin', async () => {
    vi.mocked(repositorioDePapeis.buscarPorId).mockResolvedValue(papelAdmin as never)

    await expect(
      servicoDePapeis.excluirPapel('role-admin')
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(servicoDePapeis.excluirPapel('role-admin')).rejects.toThrow(
      'protegido'
    )
  })

  it('lança 404 quando papel não existe', async () => {
    vi.mocked(repositorioDePapeis.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDePapeis.excluirPapel('inexistente')
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('exclui papel customizado com sucesso', async () => {
    vi.mocked(repositorioDePapeis.buscarPorId).mockResolvedValue(papelCustom as never)
    vi.mocked(repositorioDePapeis.excluir).mockResolvedValue(papelCustom as never)

    await expect(
      servicoDePapeis.excluirPapel('role-custom')
    ).resolves.toBeDefined()
  })
})

describe('servicoDePapeis.buscarPapelPorId', () => {
  it('lança 404 quando papel não existe', async () => {
    vi.mocked(repositorioDePapeis.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDePapeis.buscarPapelPorId('inexistente')
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('retorna o papel quando encontrado', async () => {
    vi.mocked(repositorioDePapeis.buscarPorId).mockResolvedValue(papelVendedor as never)

    const papel = await servicoDePapeis.buscarPapelPorId('role-vendedor')
    expect(papel.name).toBe('vendedor')
  })
})
