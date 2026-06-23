import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { controladorDeAtalhos } from './controlador-atalhos.js'

export async function rotasDeConfiguracoes(
  aplicacao: FastifyInstance
): Promise<void> {
  aplicacao.get(
    '/atalhos',
    { preHandler: [middlewareDeAutenticacao] },
    controladorDeAtalhos.listar
  )

  aplicacao.put(
    '/atalhos',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:edit'),
      ],
    },
    controladorDeAtalhos.salvar
  )

  aplicacao.post(
    '/atalhos/restaurar-padroes',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:edit'),
      ],
    },
    controladorDeAtalhos.restaurarPadroes
  )
}
