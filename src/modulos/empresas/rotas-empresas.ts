/**
 * Rotas HTTP do módulo de empresas.
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { servicoDeEmpresas } from './servico-empresas.js'

/**
 * Registra rota para listar empresas disponíveis.
 * @param aplicacao - Instância do servidor Fastify
 * @returns void
 */
export async function rotasDeEmpresas(
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
      const empresas = await servicoDeEmpresas.listarEmpresas()
      return { empresas }
    }
  )
}
