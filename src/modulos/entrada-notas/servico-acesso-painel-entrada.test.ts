import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('../permissoes/repositorio-permissoes.js', () => ({
  repositorioDePermissoes: {
    buscarNomesDosPapeisPorIdDoUsuario: vi.fn(),
    usuarioPossuiPermissao: vi.fn(),
  },
}))

import { repositorioDePermissoes } from '../permissoes/repositorio-permissoes.js'
import {
  exigirAcessoPainelEntradaNotas,
  usuarioRestritoEntradaAdministrativo,
} from './servico-acesso-painel-entrada.js'

describe('servico-acesso-painel-entrada', () => {
  beforeEach(() => {
    vi.mocked(repositorioDePermissoes.buscarNomesDosPapeisPorIdDoUsuario).mockReset()
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockReset()
  })

  it('administrativo sem compras:view é restrito', async () => {
    vi.mocked(repositorioDePermissoes.buscarNomesDosPapeisPorIdDoUsuario).mockResolvedValue([
      'administrativo',
    ])
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(false)

    await expect(usuarioRestritoEntradaAdministrativo('u1')).resolves.toBe(true)
  })

  it('comprador com compras:view não é restrito', async () => {
    vi.mocked(repositorioDePermissoes.buscarNomesDosPapeisPorIdDoUsuario).mockResolvedValue([
      'comprador',
    ])
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(true)

    await expect(usuarioRestritoEntradaAdministrativo('u1')).resolves.toBe(false)
  })

  it('restrito: painel analise retorna 403', async () => {
    vi.mocked(repositorioDePermissoes.buscarNomesDosPapeisPorIdDoUsuario).mockResolvedValue([
      'administrativo',
    ])
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(false)

    await expect(
      exigirAcessoPainelEntradaNotas('u1', { painel: 'analise' })
    ).rejects.toMatchObject({ codigoHttp: 403 } satisfies Partial<ErroDaAplicacao>)
  })

  it('restrito: aguardando_chegada permitido', async () => {
    vi.mocked(repositorioDePermissoes.buscarNomesDosPapeisPorIdDoUsuario).mockResolvedValue([
      'administrativo',
    ])
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(false)

    await expect(
      exigirAcessoPainelEntradaNotas('u1', { painel: 'aguardando_chegada' })
    ).resolves.toBeUndefined()
  })

  it('comprador: painel analise permitido', async () => {
    vi.mocked(repositorioDePermissoes.buscarNomesDosPapeisPorIdDoUsuario).mockResolvedValue([
      'comprador',
    ])
    vi.mocked(repositorioDePermissoes.usuarioPossuiPermissao).mockResolvedValue(true)

    await expect(
      exigirAcessoPainelEntradaNotas('u1', { painel: 'analise' })
    ).resolves.toBeUndefined()
  })
})
