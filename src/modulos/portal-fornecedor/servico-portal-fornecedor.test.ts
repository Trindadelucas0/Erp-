import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./repositorio-portal-fornecedor.js', () => ({
  repositorioDoPortalFornecedor: {
    buscarSessaoValidaPorToken: vi.fn(),
    buscarPedidoCompletoPorId: vi.fn(),
    revogarSessoesDoPedido: vi.fn(),
    buscarPedidoParaLiberar: vi.fn(),
    buscarAnexoPorId: vi.fn(),
    excluirAnexo: vi.fn(),
  },
}))

vi.mock('./armazenamento-anexo-fornecedor.js', () => ({
  removerAnexoFornecedor: vi.fn(),
}))

import { repositorioDoPortalFornecedor } from './repositorio-portal-fornecedor.js'
import { removerAnexoFornecedor } from './armazenamento-anexo-fornecedor.js'
import { servicoDoPortalFornecedor } from './servico-portal-fornecedor.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

const PRECO_UNITARIO_SENTINELA = 654.32
const TOTAL_SENTINELA = 6543.2

function pedidoCompletoMock() {
  return {
    id: 'pedido-1',
    numero: 7,
    companyId: 'company-1',
    fornecedor: { nome: 'Fornecedor ABC' },
    transportadora: null,
    modalidadeTransporte: 'CIF',
    condicaoPagamento: '30 dias',
    previsaoEntrega: null,
    observacoes: null,
    status: 'enviado',
    portalBloqueadoEm: null,
    itens: [
      {
        produtoId: 'produto-1',
        codigoOriginal: 'COD-1',
        unidade: 'UN',
        quantidade: 5,
        precoUnitario: PRECO_UNITARIO_SENTINELA,
        total: TOTAL_SENTINELA,
        produto: {
          sku: 'SKU-1',
          codigoBarras: '789000',
          nomeVenda: 'Produto teste',
          fotos: [],
        },
      },
    ],
    anexosFornecedor: [
      {
        id: 'anexo-1',
        nomeArquivo: 'documento.pdf',
        enviadoEm: new Date(),
        tipoAnexo: 'documento_fornecedor',
        statusConferencia: 'ajuste_solicitado',
        motivoAjuste: 'Quantidade divergente',
        relatorioConferenciaJson: { statusGeral: 'divergencias' },
      },
      {
        id: 'anexo-relatorio',
        nomeArquivo: 'Conferência IA - documento - 15-07-2026 15h30.pdf',
        enviadoEm: new Date(),
        tipoAnexo: 'relatorio_conferencia_ia',
        statusConferencia: 'pendente',
        motivoAjuste: null,
        relatorioConferenciaJson: null,
      },
    ],
  }
}

describe('servicoDoPortalFornecedor.buscarPedidoParaPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('não expõe preço unitário nem total dos itens', async () => {
    vi.mocked(repositorioDoPortalFornecedor.buscarSessaoValidaPorToken).mockResolvedValue({
      pedidoCompraId: 'pedido-1',
    } as never)
    vi.mocked(repositorioDoPortalFornecedor.buscarPedidoCompletoPorId).mockResolvedValue(
      pedidoCompletoMock() as never
    )

    const pedido = await servicoDoPortalFornecedor.buscarPedidoParaPortal('token-valido')

    expect(pedido.itens).toHaveLength(1)
    expect(pedido.itens[0]).not.toHaveProperty('precoUnitario')
    expect(pedido.itens[0]).not.toHaveProperty('total')
    expect(pedido.itens[0]).not.toHaveProperty('precoTotal')
    expect(JSON.stringify(pedido)).not.toContain(String(PRECO_UNITARIO_SENTINELA))
    expect(JSON.stringify(pedido)).not.toContain(String(TOTAL_SENTINELA))
  })

  it('não expõe o relatório da conferência nos anexos', async () => {
    vi.mocked(repositorioDoPortalFornecedor.buscarSessaoValidaPorToken).mockResolvedValue({
      pedidoCompraId: 'pedido-1',
    } as never)
    vi.mocked(repositorioDoPortalFornecedor.buscarPedidoCompletoPorId).mockResolvedValue(
      pedidoCompletoMock() as never
    )

    const pedido = await servicoDoPortalFornecedor.buscarPedidoParaPortal('token-valido')

    expect(pedido.anexos).toHaveLength(1)
    expect(pedido.anexos[0]).not.toHaveProperty('relatorioConferenciaJson')
    expect(pedido.anexos[0]).not.toHaveProperty('temRelatorioPdf')
    expect(pedido.anexos[0]).toEqual({
      id: 'anexo-1',
      nomeArquivo: 'documento.pdf',
      enviadoEm: expect.any(Date),
      statusConferencia: 'ajuste_solicitado',
      motivoAjuste: 'Quantidade divergente',
    })
  })

  it('não expõe cópias de relatório de conferência IA no portal', async () => {
    vi.mocked(repositorioDoPortalFornecedor.buscarSessaoValidaPorToken).mockResolvedValue({
      pedidoCompraId: 'pedido-1',
    } as never)
    vi.mocked(repositorioDoPortalFornecedor.buscarPedidoCompletoPorId).mockResolvedValue(
      pedidoCompletoMock() as never
    )

    const pedido = await servicoDoPortalFornecedor.buscarPedidoParaPortal('token-valido')

    expect(pedido.anexos.some((a) => a.nomeArquivo.includes('Conferência IA'))).toBe(false)
  })
})

describe('servicoDoPortalFornecedor sem rotas de relatório', () => {
  it('não expõe mais buscarRelatorioConferenciaAnexo nem baixarRelatorioConferenciaAnexo', () => {
    expect(servicoDoPortalFornecedor).not.toHaveProperty('buscarRelatorioConferenciaAnexo')
    expect(servicoDoPortalFornecedor).not.toHaveProperty('baixarRelatorioConferenciaAnexo')
  })
})

describe('servicoDoPortalFornecedor.excluirAnexo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('remove anexo pendente do disco e do banco', async () => {
    vi.mocked(repositorioDoPortalFornecedor.buscarPedidoParaLiberar).mockResolvedValue({
      id: 'pedido-1',
    } as never)
    vi.mocked(repositorioDoPortalFornecedor.buscarAnexoPorId).mockResolvedValue({
      id: 'anexo-1',
      pedidoCompraId: 'pedido-1',
      statusConferencia: 'pendente',
      caminhoArquivo: '/tmp/doc.pdf',
    } as never)

    await servicoDoPortalFornecedor.excluirAnexo('pedido-1', 'anexo-1', 'company-1')

    expect(removerAnexoFornecedor).toHaveBeenCalledWith('/tmp/doc.pdf')
    expect(repositorioDoPortalFornecedor.excluirAnexo).toHaveBeenCalledWith('anexo-1')
  })

  it('bloqueia exclusão de anexo já aprovado', async () => {
    vi.mocked(repositorioDoPortalFornecedor.buscarPedidoParaLiberar).mockResolvedValue({
      id: 'pedido-1',
    } as never)
    vi.mocked(repositorioDoPortalFornecedor.buscarAnexoPorId).mockResolvedValue({
      id: 'anexo-1',
      pedidoCompraId: 'pedido-1',
      statusConferencia: 'aprovado',
      caminhoArquivo: '/tmp/doc.pdf',
    } as never)

    await expect(
      servicoDoPortalFornecedor.excluirAnexo('pedido-1', 'anexo-1', 'company-1')
    ).rejects.toBeInstanceOf(ErroDaAplicacao)

    expect(removerAnexoFornecedor).not.toHaveBeenCalled()
    expect(repositorioDoPortalFornecedor.excluirAnexo).not.toHaveBeenCalled()
  })
})
