import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioPedidosVenda } from './repositorio-pedidos-venda.js'

async function listar(companyId: string) {
  return repositorioPedidosVenda.listar(companyId)
}

async function obter(companyId: string, id: string) {
  const pedido = await repositorioPedidosVenda.buscarPorId(companyId, id)
  if (!pedido) throw new ErroDaAplicacao('Pedido de venda não encontrado', 404)
  return pedido
}

export const servicoPedidosVenda = { listar, obter }
