import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioDeRequisicoesWms } from '../requisicoes-wms/repositorio-requisicoes-wms.js'
import {
  MSG_CHAMADO_JA_RECEBIDO,
  MSG_FORMA_ORIGEM_INVALIDA,
  MSG_PAGAMENTO_INCOMPLETO,
  STATUS_CHAMADO_ATENDENTE,
  STATUS_VENDA_PAGA,
  type DadosChamarAtendente,
  type DadosConfirmarChamado,
  type DadosConfirmarPagamento,
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
}
