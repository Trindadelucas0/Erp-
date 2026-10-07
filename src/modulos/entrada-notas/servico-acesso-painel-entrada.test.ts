import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

vi.mock('../acesso/repositorio-acesso-telas.js', () => ({
  repositorioDeAcessoTelas: {
    usuarioEhAdmin: vi.fn(),
    usuarioPossuiPagina: vi.fn(),
    usuarioPossuiAba: vi.fn(),
  },
}))

import { repositorioDeAcessoTelas } from '../acesso/repositorio-acesso-telas.js'
import { exigirAcessoPainelEntradaNotas } from './servico-acesso-painel-entrada.js'

describe('servico-acesso-painel-entrada', () => {
  beforeEach(() => {
    vi.mocked(repositorioDeAcessoTelas.usuarioEhAdmin).mockReset()
    vi.mocked(repositorioDeAcessoTelas.usuarioPossuiPagina).mockReset()
    vi.mocked(repositorioDeAcessoTelas.usuarioPossuiAba).mockReset()
    vi.mocked(repositorioDeAcessoTelas.usuarioEhAdmin).mockResolvedValue(false)
    vi.mocked(repositorioDeAcessoTelas.usuarioPossuiPagina).mockResolvedValue(true)
  })

  it('painel analise sem aba retorna 403', async () => {
    vi.mocked(repositorioDeAcessoTelas.usuarioPossuiAba).mockResolvedValue(false)

    await expect(
      exigirAcessoPainelEntradaNotas('u1', { painel: 'analise' })
    ).rejects.toMatchObject({ codigoHttp: 403 } satisfies Partial<ErroDaAplicacao>)
  })

  it('aguardando_chegada permitido com aba', async () => {
    vi.mocked(repositorioDeAcessoTelas.usuarioPossuiAba).mockResolvedValue(true)

    await expect(
      exigirAcessoPainelEntradaNotas('u1', { painel: 'aguardando_chegada' })
    ).resolves.toBeUndefined()
  })

  it('admin ignora checagem de aba', async () => {
    vi.mocked(repositorioDeAcessoTelas.usuarioEhAdmin).mockResolvedValue(true)

    await expect(
      exigirAcessoPainelEntradaNotas('u1', { painel: 'analise' })
    ).resolves.toBeUndefined()
    expect(repositorioDeAcessoTelas.usuarioPossuiAba).not.toHaveBeenCalled()
  })
})
