import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeEstruturaWms } from './controlador-estrutura-wms.js'

export async function rotasDeEstruturaWms(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:view')] },
    controladorDeEstruturaWms.listarNiveis
  )

  aplicacao.get(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:view')] },
    controladorDeEstruturaWms.buscarNivel
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:create')] },
    controladorDeEstruturaWms.criarNivel
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:edit')] },
    controladorDeEstruturaWms.editarNivel
  )
}
