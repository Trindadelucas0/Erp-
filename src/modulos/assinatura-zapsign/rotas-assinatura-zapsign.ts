/**
 * Rotas HTTP do módulo de assinatura digital ZapSign.
 * Todas as rotas admin exigem autenticação + empresa ativa + papel admin.
 * O webhook é público (chamado pela ZapSign).
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { middlewareSomenteAdmin } from '../../infraestrutura/autenticacao/middleware-somente-admin.js'
import { controladorDeAssinaturaZapsign } from './controlador-assinatura-zapsign.js'

export async function rotasDeAssinaturaZapsign(aplicacao: FastifyInstance): Promise<void> {
  const admin = [middlewareDeAutenticacao, middlewareEmpresaAtiva, middlewareSomenteAdmin]

  // Webhook público — chamado diretamente pela ZapSign
  aplicacao.post('/webhook', controladorDeAssinaturaZapsign.receberWebhook)

  // Configuração
  aplicacao.get('/config', { preHandler: admin }, controladorDeAssinaturaZapsign.buscarConfig)
  aplicacao.post('/config', { preHandler: admin }, controladorDeAssinaturaZapsign.salvarConfig)

  // Testar conexão com API key atual
  aplicacao.post(
    '/testar-conexao',
    { preHandler: admin },
    controladorDeAssinaturaZapsign.testarConexao
  )

  // Documentos
  aplicacao.get(
    '/documentos',
    { preHandler: admin },
    controladorDeAssinaturaZapsign.listarDocumentos
  )
  aplicacao.post(
    '/documentos',
    { preHandler: admin },
    controladorDeAssinaturaZapsign.enviarDocumento
  )
  aplicacao.post(
    '/documentos/sincronizar',
    { preHandler: admin },
    controladorDeAssinaturaZapsign.sincronizarPendentes
  )
  aplicacao.get(
    '/documentos/:token',
    { preHandler: admin },
    controladorDeAssinaturaZapsign.detalharDocumento
  )
}
