import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacaoQualquer } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorDePendencias } from './controlador-pendencias.js'

export async function rotasDePendencias(aplicacao: FastifyInstance) {
  const auth = [
    middlewareDeAutenticacao,
    middlewareEmpresaAtiva,
    middlewareDeAutorizacaoQualquer(
      'financeiro:view',
      'compras:view',
      'estoque:view',
      'clientes:view'
    ),
  ]

  aplicacao.get('/resumo', { preHandler: auth }, controladorDePendencias.resumo)
  aplicacao.get('/', { preHandler: auth }, controladorDePendencias.listar)
}
