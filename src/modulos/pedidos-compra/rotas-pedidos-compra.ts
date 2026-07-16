/**
 * Rotas HTTP do módulo de pedidos de compra.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao, middlewareDeAutorizacaoQualquer } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDePedidosCompra } from './controlador-pedidos-compra.js'
import { controladorCreditosPendencias } from './controlador-creditos-pendencias.js'

export async function rotasDePedidosCompra(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/creditos-fornecedor',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:view')] },
    controladorCreditosPendencias.listarCreditos
  )

  aplicacao.post(
    '/creditos-fornecedor',
    { preHandler: [...auth, middlewareDeAutorizacaoQualquer('compras:create', 'compras:edit')] },
    controladorCreditosPendencias.criarCredito
  )

  aplicacao.get(
    '/pendencias-fornecedor',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:view')] },
    controladorCreditosPendencias.listarPendencias
  )

  aplicacao.post(
    '/pendencias-fornecedor',
    { preHandler: [...auth, middlewareDeAutorizacaoQualquer('compras:create', 'compras:edit')] },
    controladorCreditosPendencias.criarPendencia
  )

  aplicacao.patch(
    '/pendencias-fornecedor/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorCreditosPendencias.resolverPendencia
  )

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:view')] },
    controladorDePedidosCompra.listarPedidosCompra
  )

  aplicacao.get(
    '/fornecedor/:fornecedorId/contexto',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:view')] },
    controladorDePedidosCompra.contextoFornecedor
  )

  aplicacao.get(
    '/produto/:produtoId/historico',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:view')] },
    controladorDePedidosCompra.historicoProduto
  )

  aplicacao.get(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:view')] },
    controladorDePedidosCompra.buscarPedidoCompra
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:create')] },
    controladorDePedidosCompra.criarPedidoCompra
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.editarPedidoCompra
  )

  aplicacao.patch(
    '/:id/cancelar',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:delete')] },
    controladorDePedidosCompra.cancelarPedidoCompra
  )

  aplicacao.post(
    '/:id/aprovar',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.aprovarPedidoCompra
  )

  aplicacao.post(
    '/:id/copiar',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:create')] },
    controladorDePedidosCompra.copiarPedidoCompra
  )

  aplicacao.post(
    '/:id/conferir-entrada',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:view')] },
    controladorDePedidosCompra.conferirEntrada
  )

  aplicacao.post(
    '/:id/comparar-pdf',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.compararPdf
  )

  aplicacao.post(
    '/:id/liberar-portal',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.liberarParaPortalFornecedor
  )

  aplicacao.post(
    '/:id/bloquear-portal',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.bloquearPortalFornecedor
  )

  aplicacao.post(
    '/:id/voltar-para-rascunho',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.voltarPedidoParaRascunho
  )

  aplicacao.post(
    '/:id/anexos-fornecedor',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.enviarAnexoFornecedor
  )

  aplicacao.get(
    '/:id/anexos-fornecedor/:anexoId/download',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:view')] },
    controladorDePedidosCompra.baixarAnexoFornecedor
  )

  aplicacao.delete(
    '/:id/anexos-fornecedor/:anexoId',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.excluirAnexoFornecedor
  )

  aplicacao.get(
    '/:id/anexos-fornecedor/:anexoId/relatorio-conferencia-pdf',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:view')] },
    controladorDePedidosCompra.baixarRelatorioConferenciaAnexo
  )

  aplicacao.post(
    '/:id/anexos-fornecedor/:anexoId/conferir-ia',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.conferirAnexoComIa
  )

  aplicacao.post(
    '/:id/anexos-fornecedor/:anexoId/aprovar',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.aprovarAnexoFornecedor
  )

  aplicacao.post(
    '/:id/anexos-fornecedor/:anexoId/solicitar-ajuste',
    { preHandler: [...auth, middlewareDeAutorizacao('compras:edit')] },
    controladorDePedidosCompra.solicitarAjusteAnexoFornecedor
  )
}
