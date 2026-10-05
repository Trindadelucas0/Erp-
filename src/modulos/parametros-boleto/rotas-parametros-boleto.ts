import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorParametrosBoleto } from './controlador-parametros-boleto.js'

export async function rotasParametrosBoleto(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorParametrosBoleto.listar
  )

  aplicacao.get(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
    controladorParametrosBoleto.obter
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:create')] },
    controladorParametrosBoleto.criar
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorParametrosBoleto.editar
  )

  aplicacao.patch(
    '/:id/ativo',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorParametrosBoleto.alterarAtivo
  )

  aplicacao.patch(
    '/:id/padrao',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorParametrosBoleto.marcarPadrao
  )

  aplicacao.post(
    '/:id/testar-conexao',
    { preHandler: [...auth, middlewareDeAutorizacao('financeiro:edit')] },
    controladorParametrosBoleto.testarConexao
  )
}
