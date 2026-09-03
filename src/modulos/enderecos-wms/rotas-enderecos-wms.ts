import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeEnderecosWms } from './controlador-enderecos-wms.js'

export async function rotasDeEnderecosWms(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:view')] },
    controladorDeEnderecosWms.listarEnderecos
  )

  aplicacao.get(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:view')] },
    controladorDeEnderecosWms.buscarEndereco
  )

  aplicacao.post(
    '/',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:create')] },
    controladorDeEnderecosWms.criarEndereco
  )

  aplicacao.put(
    '/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('estoque:edit')] },
    controladorDeEnderecosWms.editarEndereco
  )
}
