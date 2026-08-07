/**
 * Rotas Contagens de entrada cega.
 * Prefixo: /contagens
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorContagens } from './controlador-contagens.js'

export async function rotasContagens(aplicacao: FastifyInstance): Promise<void> {
  const autenticado = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get(
    '/disponiveis',
    { preHandler: autenticado },
    controladorContagens.listarDisponiveis
  )
  aplicacao.post('/', { preHandler: autenticado }, controladorContagens.criar)
  aplicacao.get('/:id', { preHandler: autenticado }, controladorContagens.detalhe)
  aplicacao.post('/:id/bip', { preHandler: autenticado }, controladorContagens.bipar)
  aplicacao.patch(
    '/:id/itens/:itemId',
    { preHandler: autenticado },
    controladorContagens.atualizarItem
  )
  aplicacao.post('/:id/gravar', { preHandler: autenticado }, controladorContagens.gravar)
  aplicacao.post('/:id/cancelar', { preHandler: autenticado }, controladorContagens.cancelar)
}
