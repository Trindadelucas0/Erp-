import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioParametrizacaoCustos } from '../configuracoes/repositorio-parametrizacao-custos.js'
import { repositorioDeOrcamentos } from '../orcamentos/repositorio-orcamentos.js'
import { repositorioDeProdutos } from '../produtos/repositorio-produtos.js'
import { repositorioDeRequisicoesWms } from '../requisicoes-wms/repositorio-requisicoes-wms.js'
import {
  MSG_CHAMADO_JA_RECEBIDO,
  MSG_FORMA_ORIGEM_INVALIDA,
  MSG_ORCAMENTO_JA_RECEBIDO,
  MSG_ORCAMENTO_NAO_ENCONTRADO,
  MSG_PAGAMENTO_INCOMPLETO,
  MSG_VALOR_RECEBIDO_INSUFICIENTE,
  STATUS_CHAMADO_ATENDENTE,
  STATUS_ORCAMENTO_RECEBIVEL,
  STATUS_VENDA_PAGA,
  type DadosChamarAtendente,
  type DadosConfirmarChamado,
  type DadosConfirmarPagamento,
  type DadosReceberOrcamento,
  type FormaPagamento,
} from './esquema-vendas-caixa.js'
import { agruparItensVenda, gerarOsSeparacaoDaVenda } from './gerar-os-separacao-venda.js'
import { repositorioDeVendasCaixa } from './repositorio-vendas-caixa.js'

function exigirEmpresa(companyId: string) {
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa obrigatória', 400)
}

function mapearVenda(venda: {
  id: string
  numero: number
  clienteNome: string
  status: string
  formaPagamento?: string | null
  separacoes?: number[]
  itens?: Array<{ produtoId: string; quantidade: number; produtoNome?: string }>
}) {
  return {
    id: venda.id,
    numero: venda.numero,
    clienteNome: venda.clienteNome,
    status: venda.status,
    formaPagamento: venda.formaPagamento ?? null,
    separacoes: venda.separacoes ?? [],
    ...(venda.itens ? { itens: venda.itens } : {}),
  }
}

async function validarItens(companyId: string, itens: Array<{ produtoId: string; quantidade: number }>) {
  for (const item of itens) {
    const produto = await repositorioDeRequisicoesWms.produtoDaEmpresa(companyId, item.produtoId)
    if (!produto) throw new ErroDaAplicacao('Produto não encontrado', 400)
  }
}

function validarFormaPorOrigem(origem: 'totem' | 'caixa', forma: FormaPagamento) {
  if (origem === 'totem' && forma === 'dinheiro') {
    throw new ErroDaAplicacao(MSG_FORMA_ORIGEM_INVALIDA, 400)
  }
  if (origem === 'caixa' && forma !== 'dinheiro') {
    throw new ErroDaAplicacao(MSG_FORMA_ORIGEM_INVALIDA, 400)
  }
}

function validarFormaReceberOrcamento(origem: 'totem' | 'caixa', forma: FormaPagamento) {
  if (origem === 'totem' && forma === 'dinheiro') {
    throw new ErroDaAplicacao(MSG_FORMA_ORIGEM_INVALIDA, 400)
  }
}

function exigirOrcamentoRecebivel(status: string) {
  if (!(STATUS_ORCAMENTO_RECEBIVEL as readonly string[]).includes(status)) {
    throw new ErroDaAplicacao(MSG_ORCAMENTO_NAO_ENCONTRADO, 404)
  }
}

async function resolverItensDoOrcamento(
  companyId: string,
  itens: Array<{
    codigo: string
    descricao: string
    quantidade: number
  }>
) {
  const linhas: Array<{ produtoId: string; quantidade: number }> = []
  for (const item of itens) {
    if (!item.codigo.trim() && !item.descricao.trim()) continue
    const sku = item.codigo.trim()
    if (!sku) {
      throw new ErroDaAplicacao(
        `Produto do orçamento sem SKU válido: ${item.descricao.trim() || 'item'}`,
        400
      )
    }
    const produto = await repositorioDeProdutos.buscarPorSkuNaEmpresa(sku, companyId)
    if (!produto) {
      throw new ErroDaAplicacao(
        `Produto do orçamento sem SKU válido: ${item.descricao.trim() || sku}`,
        400
      )
    }
    linhas.push({ produtoId: produto.id, quantidade: Number(item.quantidade) })
  }
  const agrupados = agruparItensVenda(linhas)
  if (agrupados.length === 0) {
    throw new ErroDaAplicacao(MSG_PAGAMENTO_INCOMPLETO, 400)
  }
  return agrupados
}

function mapearOrcamentoResposta(orcamento: Awaited<ReturnType<typeof repositorioDeOrcamentos.buscarPorId>>) {
  if (!orcamento) return null
  return {
    id: orcamento.id,
    numero: orcamento.numero,
    data: orcamento.data,
    validade: orcamento.validade,
    status: orcamento.status,
    vendedorId: orcamento.vendedorId,
    clienteNome: orcamento.clienteNome,
    cnpj: orcamento.cnpj,
    telefone: orcamento.telefone,
    email: orcamento.email,
    condicaoPagamento: orcamento.condicaoPagamento,
    descontoTotal: orcamento.descontoTotal,
    valorFrete: orcamento.valorFrete,
    outrasDespesas: orcamento.outrasDespesas,
    total: orcamento.total,
    itens: orcamento.itens,
  }
}

async function vendaPagaDoOrcamento(companyId: string, orcamentoId: string) {
  const venda = await repositorioDeVendasCaixa.obterPorOrcamentoId(companyId, orcamentoId)
  if (venda?.status === STATUS_VENDA_PAGA) {
    throw new ErroDaAplicacao(MSG_ORCAMENTO_JA_RECEBIDO, 409)
  }
  return venda
}

function validarValorRecebidoDinheiro(
  forma: FormaPagamento,
  total: number,
  valorRecebido: number | undefined
) {
  if (forma !== 'dinheiro') return
  const recebido = valorRecebido ?? 0
  if (!Number.isFinite(recebido) || recebido + 0.0001 < total) {
    throw new ErroDaAplicacao(MSG_VALOR_RECEBIDO_INSUFICIENTE, 400)
  }
}

export const servicoDeVendasCaixa = {
  async listar(companyId: string) {
    exigirEmpresa(companyId)
    const [vendas, chamados] = await Promise.all([
      repositorioDeVendasCaixa.listarPagas(companyId),
      repositorioDeVendasCaixa.listarChamados(companyId),
    ])
    return {
      vendas: vendas.map((venda) =>
        mapearVenda({
          id: venda.id,
          numero: venda.numero,
          clienteNome: venda.clienteNome,
          status: venda.status,
          formaPagamento: venda.formaPagamento,
          separacoes: venda.requisicoes.map((requisicao) => requisicao.numero),
        })
      ),
      chamados: chamados.map((venda) =>
        mapearVenda({
          id: venda.id,
          numero: venda.numero,
          clienteNome: venda.clienteNome,
          status: venda.status,
          formaPagamento: venda.formaPagamento,
          itens: venda.itens.map((item) => ({
            produtoId: item.produtoId,
            quantidade: Number(item.quantidade),
            produtoNome: item.produto.nomeVenda,
          })),
        })
      ),
    }
  },

  async confirmarPagamento(companyId: string, usuarioId: string, dados: DadosConfirmarPagamento) {
    exigirEmpresa(companyId)
    validarFormaPorOrigem(dados.origem, dados.formaPagamento)
    const clienteNome = dados.clienteNome.trim()
    const itens = agruparItensVenda(dados.itens)
    if (!clienteNome || itens.length === 0) {
      throw new ErroDaAplicacao(MSG_PAGAMENTO_INCOMPLETO, 400)
    }
    await validarItens(companyId, itens)

    return repositorioDeVendasCaixa.executarEmTransacao(async (tx) => {
      const numero = await repositorioDeVendasCaixa.proximoNumero(companyId, tx)
      const venda = await tx.vendaCaixa.create({
        data: {
          companyId,
          numero,
          clienteNome,
          status: STATUS_VENDA_PAGA,
          formaPagamento: dados.formaPagamento,
          pagaEm: new Date(),
          itens: {
            create: itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
            })),
          },
        },
        select: {
          id: true,
          numero: true,
          clienteNome: true,
          status: true,
          formaPagamento: true,
        },
      })
      const requisicoes = await gerarOsSeparacaoDaVenda({
        companyId,
        vendaCaixaId: venda.id,
        numeroVenda: venda.numero,
        usuarioId,
        itens,
        tx,
      })
      return mapearVenda({
        ...venda,
        separacoes: requisicoes.map((requisicao) => requisicao.numero),
      })
    })
  },

  async chamarAtendente(companyId: string, dados: DadosChamarAtendente) {
    exigirEmpresa(companyId)
    const clienteNome = dados.clienteNome.trim()
    const itens = agruparItensVenda(dados.itens)
    if (!clienteNome || itens.length === 0) {
      throw new ErroDaAplicacao(MSG_PAGAMENTO_INCOMPLETO, 400)
    }
    await validarItens(companyId, itens)

    return repositorioDeVendasCaixa.executarEmTransacao(async (tx) => {
      const numero = await repositorioDeVendasCaixa.proximoNumero(companyId, tx)
      const venda = await tx.vendaCaixa.create({
        data: {
          companyId,
          numero,
          clienteNome,
          status: STATUS_CHAMADO_ATENDENTE,
          formaPagamento: null,
          pagaEm: new Date(),
          itens: {
            create: itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
            })),
          },
        },
        select: {
          id: true,
          numero: true,
          clienteNome: true,
          status: true,
          formaPagamento: true,
        },
      })
      return mapearVenda({ ...venda, separacoes: [] })
    })
  },

  async confirmarChamado(
    companyId: string,
    usuarioId: string,
    vendaId: string,
    dados: DadosConfirmarChamado
  ) {
    exigirEmpresa(companyId)
    const venda = await repositorioDeVendasCaixa.obterPorId(companyId, vendaId)
    if (!venda) throw new ErroDaAplicacao('Venda não encontrada', 404)
    if (venda.status !== STATUS_CHAMADO_ATENDENTE) {
      throw new ErroDaAplicacao(MSG_CHAMADO_JA_RECEBIDO, 409)
    }

    const itens = agruparItensVenda(
      venda.itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: Number(item.quantidade),
      }))
    )

    return repositorioDeVendasCaixa.executarEmTransacao(async (tx) => {
      const atualizada = await tx.vendaCaixa.updateMany({
        where: {
          id: vendaId,
          companyId,
          status: STATUS_CHAMADO_ATENDENTE,
        },
        data: {
          status: STATUS_VENDA_PAGA,
          formaPagamento: dados.formaPagamento,
          pagaEm: new Date(),
        },
      })
      if (atualizada.count === 0) {
        throw new ErroDaAplicacao(MSG_CHAMADO_JA_RECEBIDO, 409)
      }

      const requisicoes = await gerarOsSeparacaoDaVenda({
        companyId,
        vendaCaixaId: vendaId,
        numeroVenda: venda.numero,
        usuarioId,
        itens,
        tx,
      })

      return mapearVenda({
        id: venda.id,
        numero: venda.numero,
        clienteNome: venda.clienteNome,
        status: STATUS_VENDA_PAGA,
        formaPagamento: dados.formaPagamento,
        separacoes: requisicoes.map((requisicao) => requisicao.numero),
      })
    })
  },

  async obterChavePix(companyId: string) {
    exigirEmpresa(companyId)
    const registro = await repositorioParametrizacaoCustos.buscarDaEmpresa(companyId)
    const chave = registro?.chavePix?.trim()
    return { chavePix: chave && chave.length > 0 ? chave : null }
  },

  async buscarOrcamentos(companyId: string, termo: string) {
    exigirEmpresa(companyId)
    const encontrados = await repositorioDeOrcamentos.buscarParaRecebimento(companyId, termo)
    const idsPagos = await repositorioDeVendasCaixa.orcamentoIdsPagos(companyId)
    return {
      orcamentos: encontrados.map((orcamento) => ({
        ...mapearOrcamentoResposta(orcamento)!,
        jaRecebido: idsPagos.has(orcamento.id),
      })),
    }
  },

  async listarAReceber(companyId: string) {
    exigirEmpresa(companyId)
    const idsPagos = await repositorioDeVendasCaixa.orcamentoIdsPagos(companyId)
    const orcamentos = await repositorioDeOrcamentos.listarRecebiveis(companyId, idsPagos)
    const chamados = await repositorioDeVendasCaixa.listarChamados(companyId)
    const chamadoPorOrcamento = new Map(
      chamados
        .filter((venda) => venda.orcamentoId)
        .map((venda) => [venda.orcamentoId as string, venda.id])
    )

    return {
      orcamentos: orcamentos.map((orcamento) => ({
        id: orcamento.id,
        numero: orcamento.numero,
        data: orcamento.data,
        clienteNome: orcamento.clienteNome,
        vendedorId: orcamento.vendedorId,
        condicaoPagamento: orcamento.condicaoPagamento,
        total: orcamento.total,
        chamadoAtendente: chamadoPorOrcamento.has(orcamento.id),
        vendaChamadoId: chamadoPorOrcamento.get(orcamento.id) ?? null,
      })),
    }
  },

  async obterOrcamentoRecebimento(companyId: string, orcamentoId: string) {
    exigirEmpresa(companyId)
    const orcamento = await repositorioDeOrcamentos.buscarPorId(companyId, orcamentoId)
    if (!orcamento) throw new ErroDaAplicacao(MSG_ORCAMENTO_NAO_ENCONTRADO, 404)
    exigirOrcamentoRecebivel(orcamento.status)
    await vendaPagaDoOrcamento(companyId, orcamentoId)
    const vendaExistente = await repositorioDeVendasCaixa.obterPorOrcamentoId(companyId, orcamentoId)
    return {
      orcamento: mapearOrcamentoResposta(orcamento),
      chamadoAtendente: vendaExistente?.status === STATUS_CHAMADO_ATENDENTE,
    }
  },

  async chamarOrcamento(companyId: string, orcamentoId: string) {
    exigirEmpresa(companyId)
    const orcamento = await repositorioDeOrcamentos.buscarPorId(companyId, orcamentoId)
    if (!orcamento) throw new ErroDaAplicacao(MSG_ORCAMENTO_NAO_ENCONTRADO, 404)
    exigirOrcamentoRecebivel(orcamento.status)

    const vendaExistente = await repositorioDeVendasCaixa.obterPorOrcamentoId(companyId, orcamentoId)
    if (vendaExistente) {
      if (vendaExistente.status === STATUS_VENDA_PAGA) {
        throw new ErroDaAplicacao(MSG_ORCAMENTO_JA_RECEBIDO, 409)
      }
      throw new ErroDaAplicacao(MSG_CHAMADO_JA_RECEBIDO, 409)
    }

    const itens = await resolverItensDoOrcamento(companyId, orcamento.itens)

    return repositorioDeVendasCaixa.executarEmTransacao(async (tx) => {
      const numero = await repositorioDeVendasCaixa.proximoNumero(companyId, tx)
      const venda = await tx.vendaCaixa.create({
        data: {
          companyId,
          orcamentoId,
          numero,
          clienteNome: orcamento.clienteNome.trim(),
          status: STATUS_CHAMADO_ATENDENTE,
          formaPagamento: null,
          pagaEm: new Date(),
          itens: {
            create: itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
            })),
          },
        },
        select: {
          id: true,
          numero: true,
          clienteNome: true,
          status: true,
          formaPagamento: true,
        },
      })
      return mapearVenda({ ...venda, separacoes: [] })
    })
  },

  async receberOrcamento(
    companyId: string,
    usuarioId: string,
    orcamentoId: string,
    dados: DadosReceberOrcamento
  ) {
    exigirEmpresa(companyId)
    validarFormaReceberOrcamento(dados.origem, dados.formaPagamento)

    const orcamento = await repositorioDeOrcamentos.buscarPorId(companyId, orcamentoId)
    if (!orcamento) throw new ErroDaAplicacao(MSG_ORCAMENTO_NAO_ENCONTRADO, 404)
    exigirOrcamentoRecebivel(orcamento.status)

    const total = orcamento.total
    validarValorRecebidoDinheiro(dados.formaPagamento, total, dados.valorRecebido)

    const vendaExistente = await repositorioDeVendasCaixa.obterPorOrcamentoId(companyId, orcamentoId)
    if (vendaExistente?.status === STATUS_VENDA_PAGA) {
      throw new ErroDaAplicacao(MSG_ORCAMENTO_JA_RECEBIDO, 409)
    }

    const itens =
      vendaExistente?.status === STATUS_CHAMADO_ATENDENTE
        ? agruparItensVenda(
            vendaExistente.itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: Number(item.quantidade),
            }))
          )
        : await resolverItensDoOrcamento(companyId, orcamento.itens)

    const valorRecebidoGravado =
      dados.formaPagamento === 'dinheiro' ? (dados.valorRecebido ?? total) : null
    const observacao = dados.observacao?.trim() || null

    return repositorioDeVendasCaixa.executarEmTransacao(async (tx) => {
      if (vendaExistente?.status === STATUS_CHAMADO_ATENDENTE) {
        const atualizada = await tx.vendaCaixa.updateMany({
          where: {
            id: vendaExistente.id,
            companyId,
            status: STATUS_CHAMADO_ATENDENTE,
          },
          data: {
            status: STATUS_VENDA_PAGA,
            formaPagamento: dados.formaPagamento,
            valorRecebido: valorRecebidoGravado,
            observacao,
            pagaEm: new Date(),
          },
        })
        if (atualizada.count === 0) {
          throw new ErroDaAplicacao(MSG_ORCAMENTO_JA_RECEBIDO, 409)
        }

        const requisicoes = await gerarOsSeparacaoDaVenda({
          companyId,
          vendaCaixaId: vendaExistente.id,
          numeroVenda: vendaExistente.numero,
          usuarioId,
          itens,
          tx,
        })

        return {
          venda: mapearVenda({
            id: vendaExistente.id,
            numero: vendaExistente.numero,
            clienteNome: vendaExistente.clienteNome,
            status: STATUS_VENDA_PAGA,
            formaPagamento: dados.formaPagamento,
            separacoes: requisicoes.map((requisicao) => requisicao.numero),
          }),
          total,
        }
      }

      if (vendaExistente) {
        throw new ErroDaAplicacao(MSG_ORCAMENTO_JA_RECEBIDO, 409)
      }

      const numero = await repositorioDeVendasCaixa.proximoNumero(companyId, tx)
      const venda = await tx.vendaCaixa.create({
        data: {
          companyId,
          orcamentoId,
          numero,
          clienteNome: orcamento.clienteNome.trim(),
          status: STATUS_VENDA_PAGA,
          formaPagamento: dados.formaPagamento,
          valorRecebido: valorRecebidoGravado,
          observacao,
          pagaEm: new Date(),
          itens: {
            create: itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
            })),
          },
        },
        select: {
          id: true,
          numero: true,
          clienteNome: true,
          status: true,
          formaPagamento: true,
        },
      })

      const requisicoes = await gerarOsSeparacaoDaVenda({
        companyId,
        vendaCaixaId: venda.id,
        numeroVenda: venda.numero,
        usuarioId,
        itens,
        tx,
      })

      return {
        venda: mapearVenda({
          ...venda,
          separacoes: requisicoes.map((requisicao) => requisicao.numero),
        }),
        total,
      }
    })
  },
}
