import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'

const registrarAuditoria = vi.fn()
const registrarMovimentoEstoque = vi.fn()
const obterSaldosAtuais = vi.fn()
const buscarMovimentoPorChave = vi.fn()

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: (...args: unknown[]) => registrarAuditoria(...args),
}))

vi.mock('../estoque/servico-estoque.js', () => ({
  servicoDeEstoque: {
    registrarMovimentoEstoque: (...args: unknown[]) => registrarMovimentoEstoque(...args),
    obterSaldosAtuais: (...args: unknown[]) => obterSaldosAtuais(...args),
  },
}))

vi.mock('../estoque/repositorio-estoque.js', () => ({
  repositorioDeEstoque: {
    buscarMovimentoPorChave: (...args: unknown[]) => buscarMovimentoPorChave(...args),
  },
}))

vi.mock('./repositorio-requisicoes-wms.js', () => ({
  repositorioDeRequisicoesWms: {
    criar: vi.fn(),
    listar: vi.fn(),
    buscarPorId: vi.fn(),
    atualizar: vi.fn(),
    atualizarNoTx: vi.fn(),
    executarEmTransacao: vi.fn(),
    enderecoDaEmpresa: vi.fn(),
    produtoDaEmpresa: vi.fn(),
    usuarioDaEmpresa: vi.fn(),
    listarOperadores: vi.fn(),
  },
}))

import { repositorioDeRequisicoesWms } from './repositorio-requisicoes-wms.js'
import { servicoDeRequisicoesWms } from './servico-requisicoes-wms.js'

const agora = new Date()

function row(parcial: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    companyId: 'c1',
    numero: 1,
    tipoOperacao: 'separacao',
    prioridade: 1,
    status: 'pendente',
    origemEnderecoId: null,
    origemEndereco: null,
    destinoEnderecoId: null,
    destinoEndereco: null,
    produtoId: null,
    produto: null,
    quantidade: null,
    qtdExecutada: null,
    conferidoOrigemEm: null,
    conferidoProdutoEm: null,
    conferidoDestinoEm: null,
    conferidoOrigemValor: null,
    conferidoProdutoValor: null,
    conferidoDestinoValor: null,
    responsavelId: null,
    responsavel: null,
    observacao: null,
    iniciadoEm: null,
    pausadoEm: null,
    concluidoEm: null,
    createdAt: agora,
    updatedAt: agora,
    eventos: [],
    ...parcial,
  }
}

describe('servicoDeRequisicoesWms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(repositorioDeRequisicoesWms.enderecoDaEmpresa).mockResolvedValue({
      id: 'e1',
      codigoCompleto: 'A-RC-20-01-2-05',
      ativo: true,
      status: 'ativo',
    })
    vi.mocked(repositorioDeRequisicoesWms.produtoDaEmpresa).mockResolvedValue({
      id: 'p1',
      sku: '9325',
      codigoBarras: '789',
      controlaEstoque: true,
      permiteEstoqueNegativo: false,
      embalagensMaster: [],
    })
    vi.mocked(repositorioDeRequisicoesWms.usuarioDaEmpresa).mockResolvedValue({
      id: 'u2',
      name: 'João',
    })
    vi.mocked(repositorioDeRequisicoesWms.executarEmTransacao).mockImplementation(
      async (fn) => fn({} as never)
    )
    vi.mocked(repositorioDeRequisicoesWms.atualizarNoTx).mockImplementation(async () => row() as never)
    obterSaldosAtuais.mockResolvedValue({
      saldos: { qtdDisponivel: 100, qtdFisica: 100, qtdReservada: 0, qtdBloqueada: 0, qtdFiscal: 0 },
    })
    buscarMovimentoPorChave.mockResolvedValue(null)
    registrarMovimentoEstoque.mockResolvedValue({ idempotente: false })
  })

  it('recusa empresa vazia', async () => {
    await expect(
      servicoDeRequisicoesWms.criar('', 'u1', {
        tipoOperacao: 'separacao',
        prioridade: 1,
        origemEnderecoId: null,
        destinoEnderecoId: null,
        produtoId: null,
        quantidade: null,
        responsavelId: null,
        observacao: null,
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('cria pendente sem responsável e atribuída com responsável', async () => {
    vi.mocked(repositorioDeRequisicoesWms.criar).mockResolvedValue(row() as never)
    await servicoDeRequisicoesWms.criar('c1', 'u1', {
      tipoOperacao: 'separacao',
      prioridade: 1,
      origemEnderecoId: null,
      destinoEnderecoId: null,
      produtoId: null,
      quantidade: null,
      responsavelId: null,
      observacao: null,
    })
    expect(repositorioDeRequisicoesWms.criar).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ status: 'pendente', responsavelId: null })
    )

    vi.mocked(repositorioDeRequisicoesWms.criar).mockResolvedValue(
      row({ status: 'atribuida', responsavelId: 'u2' }) as never
    )
    await servicoDeRequisicoesWms.criar('c1', 'u1', {
      tipoOperacao: 'separacao',
      prioridade: 2,
      origemEnderecoId: null,
      destinoEnderecoId: null,
      produtoId: null,
      quantidade: null,
      responsavelId: 'u2',
      observacao: null,
    })
    expect(repositorioDeRequisicoesWms.criar).toHaveBeenLastCalledWith(
      'c1',
      expect.objectContaining({ status: 'atribuida', responsavelId: 'u2' })
    )
  })

  it('404 em outro tenant', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(null)
    await expect(servicoDeRequisicoesWms.buscar('c2', 'req-1')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('operador não inicia tarefa de outro', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({ status: 'atribuida', responsavelId: 'outro', tipoOperacao: 'limpeza' }) as never
    )
    await expect(
      servicoDeRequisicoesWms.transicionar({
        companyId: 'c1',
        id: 'req-1',
        usuarioId: 'eu',
        acao: 'iniciar',
      })
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('iniciar em disponível autoatribui o operador', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({ status: 'disponivel', responsavelId: null, tipoOperacao: 'limpeza' }) as never
    )
    vi.mocked(repositorioDeRequisicoesWms.atualizar).mockResolvedValue(
      row({ status: 'em_execucao', responsavelId: 'eu', tipoOperacao: 'limpeza' }) as never
    )
    await servicoDeRequisicoesWms.transicionar({
      companyId: 'c1',
      id: 'req-1',
      usuarioId: 'eu',
      acao: 'iniciar',
    })
    expect(repositorioDeRequisicoesWms.atualizar).toHaveBeenCalledWith(
      'c1',
      'req-1',
      expect.objectContaining({ status: 'em_execucao', responsavelId: 'eu' }),
      expect.objectContaining({ acao: 'iniciar' })
    )
  })

  it('iniciar Separação sem produto recusa', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({ status: 'atribuida', responsavelId: 'eu', tipoOperacao: 'separacao' }) as never
    )
    await expect(
      servicoDeRequisicoesWms.transicionar({
        companyId: 'c1',
        id: 'req-1',
        usuarioId: 'eu',
        acao: 'iniciar',
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('iniciar Separação reserva kardex na mesma transação', async () => {
    const sep = row({
      status: 'atribuida',
      responsavelId: 'eu',
      tipoOperacao: 'separacao',
      produtoId: 'p1',
      quantidade: 10,
      produto: {
        id: 'p1',
        nomeVenda: 'Cabo',
        sku: '9325',
        codigoBarras: '789',
        controlaEstoque: true,
        permiteEstoqueNegativo: false,
        unidade: 'UN',
        embalagensMaster: [],
      },
    })
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(sep as never)
    vi.mocked(repositorioDeRequisicoesWms.atualizarNoTx).mockResolvedValue(
      { ...sep, status: 'em_execucao' } as never
    )
    await servicoDeRequisicoesWms.transicionar({
      companyId: 'c1',
      id: 'req-1',
      usuarioId: 'eu',
      acao: 'iniciar',
    })
    expect(registrarMovimentoEstoque).toHaveBeenCalledWith(
      expect.objectContaining({
        dimensao: 'reserva',
        quantidade: 10,
        chaveIdempotencia: 'reqwms:req-1:reserva',
        tipoMovimento: 'requisicao_reserva',
      }),
      expect.anything()
    )
    expect(repositorioDeRequisicoesWms.executarEmTransacao).toHaveBeenCalled()
    expect(repositorioDeRequisicoesWms.atualizarNoTx).toHaveBeenCalled()
  })

  it('iniciar Separação recusa se disponível < pedido', async () => {
    obterSaldosAtuais.mockResolvedValue({
      saldos: { qtdDisponivel: 2, qtdFisica: 2, qtdReservada: 0, qtdBloqueada: 0, qtdFiscal: 0 },
    })
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({
        status: 'atribuida',
        responsavelId: 'eu',
        produtoId: 'p1',
        quantidade: 10,
        produto: { controlaEstoque: true, permiteEstoqueNegativo: false, embalagensMaster: [] },
      }) as never
    )
    await expect(
      servicoDeRequisicoesWms.transicionar({
        companyId: 'c1',
        id: 'req-1',
        usuarioId: 'eu',
        acao: 'iniciar',
      })
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(registrarMovimentoEstoque).not.toHaveBeenCalled()
  })

  it('cancelar sem motivo no serviço ainda registra se o controlador validar; 409 se concluída', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({ status: 'concluida' }) as never
    )
    await expect(
      servicoDeRequisicoesWms.transicionar({
        companyId: 'c1',
        id: 'req-1',
        usuarioId: 'u1',
        acao: 'cancelar',
        motivo: 'erro',
      })
    ).rejects.toBeInstanceOf(ErroDaAplicacao)
  })

  it('concluir Separação sem conferência recusa', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({
        status: 'em_execucao',
        responsavelId: 'eu',
        produtoId: 'p1',
        quantidade: 10,
      }) as never
    )
    await expect(
      servicoDeRequisicoesWms.transicionar({
        companyId: 'c1',
        id: 'req-1',
        usuarioId: 'eu',
        acao: 'concluir',
      })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('concluir Limpeza sem campos da OS não chama estoque', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({ status: 'em_execucao', responsavelId: 'eu', tipoOperacao: 'limpeza' }) as never
    )
    vi.mocked(repositorioDeRequisicoesWms.atualizar).mockResolvedValue(
      row({ status: 'concluida', responsavelId: 'eu', tipoOperacao: 'limpeza' }) as never
    )
    await servicoDeRequisicoesWms.transicionar({
      companyId: 'c1',
      id: 'req-1',
      usuarioId: 'eu',
      acao: 'concluir',
    })
    expect(registrarMovimentoEstoque).not.toHaveBeenCalled()
    expect(repositorioDeRequisicoesWms.atualizar).toHaveBeenCalledTimes(1)
  })

  it('concluir Reposição com conferência não move kardex', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({
        status: 'em_execucao',
        responsavelId: 'eu',
        tipoOperacao: 'reposicao',
        origemEnderecoId: 'o1',
        destinoEnderecoId: 'd1',
        produtoId: 'p1',
        quantidade: 5,
        conferidoOrigemEm: agora,
        conferidoProdutoEm: agora,
        conferidoDestinoEm: agora,
        qtdExecutada: 5,
      }) as never
    )
    vi.mocked(repositorioDeRequisicoesWms.atualizar).mockResolvedValue(row({ status: 'concluida' }) as never)
    await servicoDeRequisicoesWms.transicionar({
      companyId: 'c1',
      id: 'req-1',
      usuarioId: 'eu',
      acao: 'concluir',
    })
    expect(registrarMovimentoEstoque).not.toHaveBeenCalled()
  })

  it('concluir Separação conferida estorna reserva e depois baixa físico', async () => {
    buscarMovimentoPorChave.mockImplementation(async (_c: string, chave: string) => {
      if (chave.endsWith(':reserva') && !chave.includes('estorno')) return { id: 'mov-r' }
      return null
    })
    const sep = row({
      status: 'em_execucao',
      responsavelId: 'eu',
      produtoId: 'p1',
      quantidade: 10,
      conferidoProdutoEm: agora,
      qtdExecutada: 10,
      produto: { controlaEstoque: true, permiteEstoqueNegativo: false, embalagensMaster: [] },
    })
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(sep as never)
    vi.mocked(repositorioDeRequisicoesWms.atualizarNoTx).mockResolvedValue(
      { ...sep, status: 'concluida' } as never
    )
    await servicoDeRequisicoesWms.transicionar({
      companyId: 'c1',
      id: 'req-1',
      usuarioId: 'eu',
      acao: 'concluir',
    })
    const tipos = registrarMovimentoEstoque.mock.calls.map((c) => c[0].tipoMovimento)
    expect(tipos).toEqual(['requisicao_estorno', 'requisicao_saida'])
    expect(registrarMovimentoEstoque.mock.calls[0][0].quantidade).toBe(-10)
    expect(registrarMovimentoEstoque.mock.calls[1][0].quantidade).toBe(-10)
    expect(registrarMovimentoEstoque.mock.calls[1][0].dimensao).toBe('fisico')
  })

  it('conferir origem errada recusa; certa grava timestamp', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({
        status: 'em_execucao',
        responsavelId: 'eu',
        origemEnderecoId: 'o1',
        origemEndereco: { codigoCompleto: 'A-RC-20-01-2-05', ativo: true, status: 'ativo' },
        produtoId: 'p1',
        quantidade: 1,
      }) as never
    )
    await expect(
      servicoDeRequisicoesWms.conferir('c1', 'req-1', 'eu', { etapa: 'origem', valor: 'errado' })
    ).rejects.toMatchObject({ statusCode: 400 })

    vi.mocked(repositorioDeRequisicoesWms.atualizar).mockResolvedValue(row() as never)
    await servicoDeRequisicoesWms.conferir('c1', 'req-1', 'eu', {
      etapa: 'origem',
      valor: 'a-rc-20-01-2-05',
    })
    expect(repositorioDeRequisicoesWms.atualizar).toHaveBeenCalledWith(
      'c1',
      'req-1',
      expect.objectContaining({ conferidoOrigemValor: 'a-rc-20-01-2-05' }),
      expect.objectContaining({ acao: 'conferir_origem' })
    )
  })

  it('outro operador não confere nem conclui', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({ status: 'em_execucao', responsavelId: 'eu', tipoOperacao: 'limpeza' }) as never
    )
    await expect(
      servicoDeRequisicoesWms.conferir('c1', 'req-1', 'outro', { etapa: 'origem', valor: 'x' })
    ).rejects.toMatchObject({ statusCode: 403 })
    await expect(
      servicoDeRequisicoesWms.transicionar({
        companyId: 'c1',
        id: 'req-1',
        usuarioId: 'outro',
        acao: 'concluir',
      })
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('PATCH de produto com execução em andamento recusa', async () => {
    vi.mocked(repositorioDeRequisicoesWms.buscarPorId).mockResolvedValue(
      row({ status: 'em_execucao', responsavelId: 'eu' }) as never
    )
    await expect(
      servicoDeRequisicoesWms.editar('c1', 'req-1', 'u1', { produtoId: 'p2' })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('fila minha passa usuarioId e fila ao repositório', async () => {
    vi.mocked(repositorioDeRequisicoesWms.listar).mockResolvedValue({
      itens: [],
      total: 0,
      resumoPorStatus: { _total: 0 },
    })
    await servicoDeRequisicoesWms.listar('c1', 'op-1', {
      fila: 'minha',
      pagina: 1,
      limite: 50,
    })
    expect(repositorioDeRequisicoesWms.listar).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ fila: 'minha', usuarioId: 'op-1' })
    )
  })
})
