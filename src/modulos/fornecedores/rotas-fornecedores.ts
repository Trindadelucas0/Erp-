/**
 * Rotas HTTP do módulo de fornecedores.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeFornecedores } from './controlador-fornecedores.js'

export async function rotasDeFornecedores(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('fornecedores:view')] },
    controladorDeFornecedores.listarFornecedores
  )

  aplicacao.get(
    '/por-documento/:documento',
    { preHandler: [...auth, middlewareDeAutorizacao('fornecedores:view')] },
    controladorDeFornecedores.buscarFornecedorPorDocumento
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('fornecedores:create')] },
    controladorDeFornecedores.criarFornecedor
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('fornecedores:edit')] },
    controladorDeFornecedores.editarFornecedor
  )

  aplicacao.patch(
    '/:id/ativo',
    { preHandler: [...auth, middlewareDeAutorizacao('fornecedores:delete')] },
    controladorDeFornecedores.alterarStatusDoFornecedor
  )
}
