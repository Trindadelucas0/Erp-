import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({ clientePrisma: {
  nfeRecebida: { findFirst: vi.fn(), updateMany: vi.fn() },
  user: { findUniqueOrThrow: vi.fn() },
} }))
vi.mock('../acesso/servico-acesso-aba.js', () => ({ exigirAcessoPagina: vi.fn() }))
vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({ registrarAuditoria: vi.fn() }))

import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { exigirAcessoPagina } from '../acesso/servico-acesso-aba.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { auditarEntrada } from './servico-auditoria-entrada.js'

describe('conclusão de auditoria', () => {
  const nota = { id: 'n1', tipoDocumento: 'nfe55', statusEntrada: 'entrada_consolidada', auditadaEm: null }
  const conclusao = { id: 'n1', auditadaEm: new Date('2026-10-14T12:00:00Z'), auditadaPorId: 'u1', auditadaPorNome: 'Gustavo' }
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(clientePrisma.user.findUniqueOrThrow).mockResolvedValue({ name: 'Gustavo' } as never)
    vi.mocked(clientePrisma.nfeRecebida.updateMany).mockResolvedValue({ count: 1 })
  })
  it.each(['nfe55', 'nfse'])('conclui %s sem mudar status, financeiro ou bloqueio', async (tipoDocumento) => {
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValueOnce({ ...nota, tipoDocumento } as never).mockResolvedValueOnce(conclusao as never)
    expect(await auditarEntrada('emp1', 'n1', 'u1')).toEqual({ nota: conclusao })
    expect(exigirAcessoPagina).toHaveBeenCalledWith('u1', 'auditoria-entradas')
    const args = vi.mocked(clientePrisma.nfeRecebida.updateMany).mock.calls[0][0]!
    expect(args.where).toMatchObject({ companyId: 'emp1', id: 'n1', auditadaEm: null, statusEntrada: 'entrada_consolidada' })
    expect(args.data).toEqual({ auditadaEm: expect.any(Date), auditadaPorId: 'u1', auditadaPorNome: 'Gustavo' })
  })
  it('não busca outra empresa e recusa nota ausente', async () => {
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValue(null)
    await expect(auditarEntrada('emp2', 'n1', 'u1')).rejects.toMatchObject({ codigoHttp: 404 })
    expect(clientePrisma.nfeRecebida.findFirst).toHaveBeenCalledWith({ where: { id: 'n1', companyId: 'emp2' } })
    expect(clientePrisma.nfeRecebida.updateMany).not.toHaveBeenCalled()
  })
  it.each([{ ...nota, tipoDocumento: 'cte' }, { ...nota, statusEntrada: 'em_analise' }])('recusa documento ou status inelegível', async (invalida) => {
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValue(invalida as never)
    await expect(auditarEntrada('emp1', 'n1', 'u1')).rejects.toMatchObject({ codigoHttp: 409 })
    expect(clientePrisma.nfeRecebida.updateMany).not.toHaveBeenCalled()
  })
  it('repetição preserva confirmação original', async () => {
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValueOnce({ ...nota, ...conclusao } as never).mockResolvedValueOnce(conclusao as never)
    expect(await auditarEntrada('emp1', 'n1', 'u2')).toEqual({ nota: conclusao })
    expect(clientePrisma.nfeRecebida.updateMany).not.toHaveBeenCalled()
  })
  it('concorrência retorna a primeira confirmação sem duplicar o log', async () => {
    vi.mocked(clientePrisma.nfeRecebida.findFirst).mockResolvedValueOnce(nota as never).mockResolvedValueOnce(conclusao as never)
    vi.mocked(clientePrisma.nfeRecebida.updateMany).mockResolvedValue({ count: 0 })
    expect(await auditarEntrada('emp1', 'n1', 'u2')).toEqual({ nota: conclusao })
    expect(registrarAuditoria).not.toHaveBeenCalled()
  })
  it('recusa acesso antes de ler ou gravar a nota', async () => {
    vi.mocked(exigirAcessoPagina).mockRejectedValue({ codigoHttp: 403 })
    await expect(auditarEntrada('emp1', 'n1', 'u1')).rejects.toMatchObject({ codigoHttp: 403 })
    expect(clientePrisma.nfeRecebida.findFirst).not.toHaveBeenCalled()
  })
})
