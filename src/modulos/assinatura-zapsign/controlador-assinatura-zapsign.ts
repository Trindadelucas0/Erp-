/**
 * Controlador ZapSign — recebe requisições HTTP e delega ao serviço.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeAssinaturaZapsign } from './servico-assinatura-zapsign.js'
import {
  esquemaParaSalvarConfig,
  esquemaParaEnviarDocumento,
  esquemaDeWebhookZapsign,
} from './esquema-assinatura-zapsign.js'
import { repositorioDeAssinaturaZapsign } from './repositorio-assinatura-zapsign.js'

async function buscarConfig(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)

  const config = await servicoDeAssinaturaZapsign.buscarConfig(companyId)
  return resposta.send({ config })
}

async function salvarConfig(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)

  const resultado = esquemaParaSalvarConfig.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  await servicoDeAssinaturaZapsign.salvarConfig(companyId, resultado.data)
  return resposta.send({ sucesso: true })
}

async function testarConexao(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)

  const resultado = await servicoDeAssinaturaZapsign.testarConexao(companyId)
  return resposta.send(resultado)
}

async function enviarDocumento(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)

  const resultado = esquemaParaEnviarDocumento.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const dados = await servicoDeAssinaturaZapsign.enviarDocumento(companyId, resultado.data)
  return resposta.status(201).send(dados)
}

async function listarDocumentos(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)

  const documentos = await servicoDeAssinaturaZapsign.listarDocumentos(companyId)
  return resposta.send({ documentos })
}

async function sincronizarPendentes(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)

  const resultado = await servicoDeAssinaturaZapsign.sincronizarPendentes(companyId)
  return resposta.send(resultado)
}

async function detalharDocumento(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const { token } = requisicao.params as { token: string }
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)

  const documento = await servicoDeAssinaturaZapsign.detalharDocumento(companyId, token)
  return resposta.send({ documento })
}

async function receberWebhook(requisicao: FastifyRequest, resposta: FastifyReply) {
  // Valida o payload antes de qualquer processamento
  const resultado = esquemaDeWebhookZapsign.safeParse(requisicao.body)
  if (!resultado.success) {
    // Responde 200 para o ZapSign não retentar, mas ignora
    return resposta.send({ ignorado: true, motivo: 'payload inválido' })
  }

  const tokenDoc = resultado.data.doc?.token
  let webhookSecret: string | undefined

  if (tokenDoc) {
    const doc = await repositorioDeAssinaturaZapsign.buscarDocumentoPorToken(tokenDoc)
    if (doc) {
      const config = await repositorioDeAssinaturaZapsign.buscarConfigPorEmpresa(doc.companyId)
      webhookSecret = config?.webhookSecret ?? undefined
    }
  }

  const headerSecret = (requisicao.headers['x-webhook-secret'] as string) || undefined

  const processamento = await servicoDeAssinaturaZapsign.processarWebhook(
    resultado.data,
    webhookSecret,
    headerSecret
  )

  // Sempre retorna 200 — ZapSign retentaria em caso de erro
  return resposta.send(processamento)
}

export const controladorDeAssinaturaZapsign = {
  buscarConfig,
  salvarConfig,
  testarConexao,
  enviarDocumento,
  listarDocumentos,
  sincronizarPendentes,
  detalharDocumento,
  receberWebhook,
}
