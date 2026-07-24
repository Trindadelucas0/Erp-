/**
 * Rotas Focus NFe — admin + empresa ativa.
 * Prefixo: /focus-nfe
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { middlewareSomenteAdmin } from '../../infraestrutura/autenticacao/middleware-somente-admin.js'
import { controladorFocusNfe } from './controlador-focus-nfe.js'

export async function rotasFocusNfe(aplicacao: FastifyInstance): Promise<void> {
  const admin = [middlewareDeAutenticacao, middlewareEmpresaAtiva, middlewareSomenteAdmin]
  const autenticado = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get('/config', { preHandler: admin }, controladorFocusNfe.buscarConfig)
  aplicacao.post('/config', { preHandler: admin }, controladorFocusNfe.salvarConfig)
  aplicacao.put('/regras-fiscais', { preHandler: admin }, controladorFocusNfe.salvarRegrasFiscais)
  aplicacao.post('/testar-conexao', { preHandler: admin }, controladorFocusNfe.testarConexao)

  aplicacao.post('/jobs/sincronizar', { preHandler: autenticado }, controladorFocusNfe.sincronizar)
  aplicacao.get('/jobs/:id', { preHandler: autenticado }, controladorFocusNfe.statusJob)
  aplicacao.get('/cota', { preHandler: autenticado }, controladorFocusNfe.buscarCota)

  aplicacao.get('/nfe-recebidas', { preHandler: autenticado }, controladorFocusNfe.listarPendentes)
  aplicacao.get(
    '/nfe-recebidas/:id/xml',
    { preHandler: autenticado },
    controladorFocusNfe.obterXml
  )
  aplicacao.get(
    '/nfe-recebidas/:id/danfe',
    { preHandler: autenticado },
    controladorFocusNfe.obterDanfe
  )
  aplicacao.post('/nfe-recebidas/importar-xml', { preHandler: autenticado }, controladorFocusNfe.importarXml)
  aplicacao.post(
    '/nfe-recebidas/reprocessar-xmls',
    { preHandler: autenticado },
    controladorFocusNfe.reprocessarXmls
  )

  aplicacao.get('/analise-fiscal/preview', { preHandler: admin }, controladorFocusNfe.previewFiscal)
}
