import type { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { controladorConciliacaoBancaria as controlador } from './controlador-conciliacao-bancaria.js'

export async function rotasConciliacaoBancaria(aplicacao: FastifyInstance) {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]
  const view = [...auth, middlewareDeAutorizacao('financeiro:view')]
  const edit = [...auth, middlewareDeAutorizacao('financeiro:edit')]

  aplicacao.get('/conciliacao-bancaria', { preHandler: view }, controlador.consultar)
  aplicacao.get('/conciliacao-bancaria/extratos', { preHandler: view }, controlador.listarExtratos)
  aplicacao.get('/conciliacao-bancaria/extratos/modelo.csv', { preHandler: view }, controlador.modeloCsv)
  aplicacao.get('/conciliacao-bancaria/relatorio', { preHandler: view }, controlador.relatorio)
  aplicacao.get('/conciliacao-bancaria/relatorio.csv', { preHandler: view }, controlador.relatorioCsv)
  aplicacao.get('/fluxo-de-caixa', { preHandler: view }, controlador.listarFluxo)
  aplicacao.get('/movimentacoes-financeiras', { preHandler: view }, controlador.listarMovimentacoes)

  aplicacao.post('/conciliacao-bancaria/extratos', { preHandler: edit }, controlador.importar)
  aplicacao.post('/conciliacao-bancaria/conciliacoes', { preHandler: edit }, controlador.concluir)
  aplicacao.post(
    '/conciliacao-bancaria/conciliacoes/:id/desvincular',
    { preHandler: edit },
    controlador.desvincular
  )
  aplicacao.post(
    '/conciliacao-bancaria/lancamentos',
    { preHandler: edit },
    controlador.criarLancamento
  )
}
