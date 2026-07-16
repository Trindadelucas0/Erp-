import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-pedidos-compra.js', () => ({
  repositorioDePedidosCompra: {
    buscarPorId: vi.fn(),
    voltarParaRascunho: vi.fn(),
  },
}))

vi.mock('../portal-fornecedor/servico-portal-fornecedor.js', () => ({
  servicoDoPortalFornecedor: {
    bloquearPortal: vi.fn(),
  },
}))

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn(),
}))

import { repositorioDePedidosCompra } from './repositorio-pedidos-compra.js'
import { servicoDoPortalFornecedor } from '../portal-fornecedor/servico-portal-fornecedor.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { servicoDePedidosCompra } from './servico-pedidos-compra.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

describe('servicoDePedidosCompra.voltarPedidoParaRascunho', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('volta pedido enviado para rascunho e bloqueia o portal', async () => {
    vi.mocked(repositorioDePedidosCompra.buscarPorId).mockResolvedValue({
      id: 'pedido-1',
      companyId: 'company-1',
      status: 'enviado',
      numero: 10,
    } as never)
    vi.mocked(repositorioDePedidosCompra.voltarParaRascunho).mockResolvedValue({
      id: 'pedido-1',
      status: 'rascunho',
      numero: 10,
    } as never)
    vi.mocked(servicoDoPortalFornecedor.bloquearPortal).mockResolvedValue(undefined as never)

    const pedido = await servicoDePedidosCompra.voltarPedidoParaRascunho(
      'pedido-1',
      'company-1',
      'user-1'
    )

    expect(pedido.status).toBe('rascunho')
    expect(repositorioDePedidosCompra.voltarParaRascunho).toHaveBeenCalledWith('pedido-1')
    expect(servicoDoPortalFornecedor.bloquearPortal).toHaveBeenCalledWith('pedido-1', 'company-1')
    expect(registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'voltar_para_rascunho',
        entidadeId: 'pedido-1',
      })
    )
  })

  it('rejeita pedido que não está com status enviado', async () => {
    vi.mocked(repositorioDePedidosCompra.buscarPorId).mockResolvedValue({
      id: 'pedido-1',
      companyId: 'company-1',
      status: 'aprovado',
    } as never)

    await expect(
      servicoDePedidosCompra.voltarPedidoParaRascunho('pedido-1', 'company-1', 'user-1')
    ).rejects.toBeInstanceOf(ErroDaAplicacao)

    expect(repositorioDePedidosCompra.voltarParaRascunho).not.toHaveBeenCalled()
    expect(servicoDoPortalFornecedor.bloquearPortal).not.toHaveBeenCalled()
  })

  it('rejeita pedido em rascunho', async () => {
    vi.mocked(repositorioDePedidosCompra.buscarPorId).mockResolvedValue({
      id: 'pedido-1',
      companyId: 'company-1',
      status: 'rascunho',
    } as never)

    await expect(
      servicoDePedidosCompra.voltarPedidoParaRascunho('pedido-1', 'company-1', 'user-1')
    ).rejects.toMatchObject({ message: expect.stringContaining('Enviado') })
  })
})
