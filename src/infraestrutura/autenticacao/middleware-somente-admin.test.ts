import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../modulos/usuarios/repositorio-usuarios.js', () => ({
  repositorioDeUsuarios: {
    buscarPorId: vi.fn(),
  },
}))

import { repositorioDeUsuarios } from '../../modulos/usuarios/repositorio-usuarios.js'
import { middlewareSomenteAdmin } from './middleware-somente-admin.js'

describe('middlewareSomenteAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('não-admin recebe 403', async () => {
    vi.mocked(repositorioDeUsuarios.buscarPorId).mockResolvedValue({
      id: 'u1',
      roles: [{ role: { name: 'operador' } }],
    } as never)

    await expect(
      middlewareSomenteAdmin({ idDoUsuario: 'u1' } as never, {} as never)
    ).rejects.toMatchObject({
      message: 'Acesso restrito ao administrador',
      codigoHttp: 403,
    })
  })
})
