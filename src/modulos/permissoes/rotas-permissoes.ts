/**
 * Rotas HTTP do módulo de permissões.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { servicoDePermissoes } from './servico-permissoes.js'

/**
 * Registra rota para listar permissões do sistema.
 * @param aplicacao - Instância do servidor Fastify
 * @returns void
 */
export async function rotasDePermissoes(
  aplicacao: FastifyInstance
): Promise<void> {
  aplicacao.get(
    '/',
    {
      preHandler: [
        middlewareDeAutenticacao,
        middlewareDeAutorizacao('configuracoes:view'),
      ],
    },
    async () => {
      const permissoes = await servicoDePermissoes.listarPermissoes()
      return { permissoes }
    }
  )
}
