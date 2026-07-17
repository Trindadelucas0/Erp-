import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-pedidos-compra.js', () => ({
  repositorioDePedidosCompra: {
    buscarPorId: vi.fn(),
    aprovar: vi.fn(),
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

describe('servicoDePedidosCompra.aprovarPedidoCompra', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aprova pedido enviado e bloqueia o portal', async () => {
    vi.mocked(repositorioDePedidosCompra.buscarPorId).mockResolvedValue({
      id: 'pedido-1',
      companyId: 'company-1',
      status: 'enviado',
      numero: 10,
      anexosFornecedor: [
        {
          tipoAnexo: 'documento_fornecedor',
          statusConferencia: 'aprovado',
        },
      ],
    } as never)
    vi.mocked(repositorioDePedidosCompra.aprovar).mockResolvedValue({
      id: 'pedido-1',
      status: 'aprovado',
      numero: 10,
    } as never)
    vi.mocked(servicoDoPortalFornecedor.bloquearPortal).mockResolvedValue(undefined as never)

    const pedido = await servicoDePedidosCompra.aprovarPedidoCompra(
      'pedido-1',
      'company-1',
      'user-1'
    )

    expect(pedido.status).toBe('aprovado')
    expect(repositorioDePedidosCompra.aprovar).toHaveBeenCalledWith('pedido-1')
    expect(servicoDoPortalFornecedor.bloquearPortal).toHaveBeenCalledWith('pedido-1', 'company-1')
    expect(registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'aprovar_pedido',
        entidadeId: 'pedido-1',
        valoresDepois: expect.objectContaining({ portalBloqueado: true }),
      })
    )
  })

  it('rejeita pedido sem documento aprovado e não bloqueia o portal', async () => {
    vi.mocked(repositorioDePedidosCompra.buscarPorId).mockResolvedValue({
      id: 'pedido-1',
      companyId: 'company-1',
      status: 'enviado',
      anexosFornecedor: [
        {
          tipoAnexo: 'documento_fornecedor',
          statusConferencia: 'pendente',
        },
      ],
    } as never)

    await expect(
      servicoDePedidosCompra.aprovarPedidoCompra('pedido-1', 'company-1', 'user-1')
    ).rejects.toBeInstanceOf(ErroDaAplicacao)

    expect(repositorioDePedidosCompra.aprovar).not.toHaveBeenCalled()
    expect(servicoDoPortalFornecedor.bloquearPortal).not.toHaveBeenCalled()
  })

  it('rejeita pedido que não está com status enviado', async () => {
    vi.mocked(repositorioDePedidosCompra.buscarPorId).mockResolvedValue({
      id: 'pedido-1',
      companyId: 'company-1',
      status: 'rascunho',
      anexosFornecedor: [],
    } as never)

    await expect(
      servicoDePedidosCompra.aprovarPedidoCompra('pedido-1', 'company-1', 'user-1')
    ).rejects.toMatchObject({ message: expect.stringContaining('Enviado') })

    expect(servicoDoPortalFornecedor.bloquearPortal).not.toHaveBeenCalled()
  })
})
