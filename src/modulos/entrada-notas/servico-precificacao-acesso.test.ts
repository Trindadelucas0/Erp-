import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./repositorio-entrada-notas.js', () => ({ repositorioEntradaNotas: { buscarNotaCompleta: vi.fn() } }))
vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({ clientePrisma: { produto: { update: vi.fn() } } }))
import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { servicoPrecificacaoEntrada } from './servico-precificacao-entrada.js'

describe('precificação restrita à revenda', () => {
  beforeEach(() => vi.resetAllMocks())
  it.each([
    { tipoDocumento: 'nfe55', finalidadeEntrada: 'uso_consumo' },
    { tipoDocumento: 'nfe55', finalidadeEntrada: null },
    { tipoDocumento: 'nfse', finalidadeEntrada: null },
    { tipoDocumento: 'cte', finalidadeEntrada: null },
  ])('recusa leitura e gravação para $tipoDocumento / $finalidadeEntrada', async (nota) => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue({ ...nota, statusEntrada: 'entrada_consolidada' } as never)
    await expect(servicoPrecificacaoEntrada.obterGrade('emp', 'n')).rejects.toMatchObject({ codigoHttp: 404 })
    await expect(servicoPrecificacaoEntrada.gravarPrecos('emp', 'n', 'u', [])).rejects.toMatchObject({ codigoHttp: 404 })
    expect(clientePrisma.produto.update).not.toHaveBeenCalled()
  })
})
