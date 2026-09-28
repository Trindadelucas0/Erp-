import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioDeRequisicoesWms } from '../requisicoes-wms/repositorio-requisicoes-wms.js'
import { MSG_PAGAMENTO_INCOMPLETO, type DadosConfirmarPagamento } from './esquema-vendas-caixa.js'
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
  separacoes: number[]
}) {
  return venda
}

export const servicoDeVendasCaixa = {
  async listar(companyId: string) {
    exigirEmpresa(companyId)
    const vendas = await repositorioDeVendasCaixa.listar(companyId)
    return vendas.map((venda) =>
      mapearVenda({
        id: venda.id,
        numero: venda.numero,
        clienteNome: venda.clienteNome,
        status: venda.status,
        separacoes: venda.requisicoes.map((requisicao) => requisicao.numero),
      })
    )
  },

  async confirmarPagamento(companyId: string, usuarioId: string, dados: DadosConfirmarPagamento) {
    exigirEmpresa(companyId)
    const clienteNome = dados.clienteNome.trim()
    const itens = agruparItensVenda(dados.itens)
    if (!clienteNome || itens.length === 0) {
      throw new ErroDaAplicacao(MSG_PAGAMENTO_INCOMPLETO, 400)
    }
    for (const item of itens) {
      const produto = await repositorioDeRequisicoesWms.produtoDaEmpresa(companyId, item.produtoId)
      if (!produto) throw new ErroDaAplicacao('Produto não encontrado', 400)
    }

    return repositorioDeVendasCaixa.executarEmTransacao(async (tx) => {
      const numero = await repositorioDeVendasCaixa.proximoNumero(companyId, tx)
      const venda = await tx.vendaCaixa.create({
        data: {
          companyId,
          numero,
          clienteNome,
          status: 'paga',
          pagaEm: new Date(),
          itens: {
            create: itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
            })),
          },
        },
        select: { id: true, numero: true, clienteNome: true, status: true },
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
}
