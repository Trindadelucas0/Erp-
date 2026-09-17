import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDeRequisicoesWms } from './controlador-requisicoes-wms.js'

export async function rotasDeRequisicoesWms(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]
  const ver = [...auth, middlewareDeAutorizacao('estoque:view')]
  const criar = [...auth, middlewareDeAutorizacao('estoque:create')]
  const editar = [...auth, middlewareDeAutorizacao('estoque:edit')]

  aplicacao.get('/', { preHandler: ver }, controladorDeRequisicoesWms.listar)
  aplicacao.get('/operadores', { preHandler: ver }, controladorDeRequisicoesWms.listarOperadores)
  aplicacao.get('/:id', { preHandler: ver }, controladorDeRequisicoesWms.buscar)
  aplicacao.post('/', { preHandler: criar }, controladorDeRequisicoesWms.criar)
  aplicacao.patch('/:id', { preHandler: editar }, controladorDeRequisicoesWms.editar)
  aplicacao.post('/:id/disponibilizar', { preHandler: editar }, controladorDeRequisicoesWms.disponibilizar)
  aplicacao.post('/:id/atribuir', { preHandler: editar }, controladorDeRequisicoesWms.atribuir)
  aplicacao.post('/:id/iniciar', { preHandler: ver }, controladorDeRequisicoesWms.iniciar)
  aplicacao.post('/:id/pausar', { preHandler: ver }, controladorDeRequisicoesWms.pausar)
  aplicacao.post('/:id/retomar', { preHandler: ver }, controladorDeRequisicoesWms.retomar)
  aplicacao.post('/:id/concluir', { preHandler: ver }, controladorDeRequisicoesWms.concluir)
  aplicacao.post('/:id/conferir', { preHandler: ver }, controladorDeRequisicoesWms.conferir)
  aplicacao.post('/:id/cancelar', { preHandler: editar }, controladorDeRequisicoesWms.cancelar)
  aplicacao.post('/:id/bloquear', { preHandler: editar }, controladorDeRequisicoesWms.bloquear)
  aplicacao.post('/:id/desbloquear', { preHandler: editar }, controladorDeRequisicoesWms.desbloquear)
}
