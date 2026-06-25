/**
 * Rotas HTTP do módulo de assinatura digital ZapSign.
 * Todas as rotas admin exigem autenticação + empresa ativa + papel admin.
 * O webhook é público (chamado pela ZapSign).
 */
import { FastifyInstance } from 'fastify'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { middlewareSomenteAdmin } from '../../infraestrutura/autenticacao/middleware-somente-admin.js'
import { middlewareReauthAssinatura } from '../../infraestrutura/autenticacao/middleware-reauth-assinatura.js'
import { controladorDeAssinaturaZapsign } from './controlador-assinatura-zapsign.js'

export async function rotasDeAssinaturaZapsign(aplicacao: FastifyInstance): Promise<void> {
  const admin = [middlewareDeAutenticacao, middlewareEmpresaAtiva, middlewareSomenteAdmin]
  // Documentos exigem confirmação de senha além do papel admin
  const adminComReauth = [...admin, middlewareReauthAssinatura]

  // Webhook público — chamado diretamente pela ZapSign
  aplicacao.post('/webhook', controladorDeAssinaturaZapsign.receberWebhook)

  // Configuração (sem reauth — só admin)
  aplicacao.get('/config', { preHandler: admin }, controladorDeAssinaturaZapsign.buscarConfig)
  aplicacao.post('/config', { preHandler: admin }, controladorDeAssinaturaZapsign.salvarConfig)

  // Testar conexão com API key atual (sem reauth — só admin)
  aplicacao.post(
    '/testar-conexao',
    { preHandler: admin },
    controladorDeAssinaturaZapsign.testarConexao
  )

  // Documentos — exigem admin + confirmação de senha (X-Reauth-Token)
  aplicacao.get(
    '/documentos',
    { preHandler: adminComReauth },
    controladorDeAssinaturaZapsign.listarDocumentos
  )
  aplicacao.post(
    '/documentos',
    { preHandler: adminComReauth },
    controladorDeAssinaturaZapsign.enviarDocumento
  )
  aplicacao.post(
    '/documentos/sincronizar',
    { preHandler: adminComReauth },
    controladorDeAssinaturaZapsign.sincronizarPendentes
  )
  aplicacao.get(
    '/documentos/:token',
    { preHandler: adminComReauth },
    controladorDeAssinaturaZapsign.detalharDocumento
  )
}
