/**
 * Rotas HTTP do portal do fornecedor.
 * Todas públicas (sem middlewareDeAutenticacao) — a sessão é validada
 * pelo próprio serviço via token opaco (header X-Portal-Token).
 */
import { FastifyInstance } from 'fastify'
import { controladorDoPortalFornecedor } from './controlador-portal-fornecedor.js'

export async function rotasDoPortalFornecedor(aplicacao: FastifyInstance): Promise<void> {
  aplicacao.post('/login', controladorDoPortalFornecedor.login)
  aplicacao.get('/pedido', controladorDoPortalFornecedor.buscarPedido)
  aplicacao.get('/pedido/excel', controladorDoPortalFornecedor.baixarExcelPedido)
  aplicacao.get('/pedido/pdf', controladorDoPortalFornecedor.baixarPdfPedido)
  aplicacao.post('/upload', controladorDoPortalFornecedor.upload)
}
