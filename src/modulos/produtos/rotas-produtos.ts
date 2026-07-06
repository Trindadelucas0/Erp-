/**
 * Rotas HTTP do módulo de produtos.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeProdutos } from './controlador-produtos.js'

export async function rotasDeProdutos(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('produtos:view')] },
    controladorDeProdutos.listarProdutos
  )

  aplicacao.get(
    '/unidades-medida',
    { preHandler: [...auth, middlewareDeAutorizacao('produtos:view')] },
    controladorDeProdutos.listarUnidadesMedida
  )

  aplicacao.post(
    '/unidades-medida',
    { preHandler: [...auth, middlewareDeAutorizacao('produtos:create')] },
    controladorDeProdutos.criarUnidadeMedida
  )

  aplicacao.get(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('produtos:view')] },
    controladorDeProdutos.buscarProduto
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('produtos:create')] },
    controladorDeProdutos.criarProduto
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('produtos:edit')] },
    controladorDeProdutos.editarProduto
  )

  aplicacao.patch(
    '/:id/ativo',
    { preHandler: [...auth, middlewareDeAutorizacao('produtos:delete')] },
    controladorDeProdutos.alterarStatusDoProduto
  )

  aplicacao.post(
    '/:id/foto',
    { preHandler: [...auth, middlewareDeAutorizacao('produtos:edit')] },
    controladorDeProdutos.salvarFotoDoProduto
  )

  aplicacao.delete(
    '/:id/foto',
    { preHandler: [...auth, middlewareDeAutorizacao('produtos:edit')] },
    controladorDeProdutos.removerFotoDoProduto
  )
}
