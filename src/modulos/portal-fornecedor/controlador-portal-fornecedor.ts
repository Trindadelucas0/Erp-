/**
 * Controlador das rotas públicas do portal do fornecedor.
 * Autenticação própria via header X-Portal-Token (token de sessão do portal,
 * não o JWT do ERP).
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDoPortalFornecedor } from './servico-portal-fornecedor.js'
import {
  esquemaLoginPortalFornecedor,
  esquemaUploadPortalFornecedor,
} from './esquema-portal-fornecedor.js'

function extrairTokenDaSessao(requisicao: FastifyRequest): string {
  const token = requisicao.headers['x-portal-token']
  if (!token || typeof token !== 'string') {
    throw new ErroDaAplicacao('Sessão do portal não informada. Faça login novamente.', 401)
  }
  return token
}

async function login(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaLoginPortalFornecedor.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const sessao = await servicoDoPortalFornecedor.login(resultado.data)
  return resposta.send(sessao)
}

async function buscarPedido(requisicao: FastifyRequest, resposta: FastifyReply) {
  const token = extrairTokenDaSessao(requisicao)
  const pedido = await servicoDoPortalFornecedor.buscarPedidoParaPortal(token)
  return resposta.send({ pedido })
}

async function baixarExcelPedido(requisicao: FastifyRequest, resposta: FastifyReply) {
  const token = extrairTokenDaSessao(requisicao)
  const { buffer, nomeArquivo } = await servicoDoPortalFornecedor.gerarExcelPedido(token)

  resposta.header('Content-Disposition', `attachment; filename="${nomeArquivo}"`)
  return resposta
    .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .send(buffer)
}

async function baixarPdfPedido(requisicao: FastifyRequest, resposta: FastifyReply) {
  const token = extrairTokenDaSessao(requisicao)
  const { buffer, nomeArquivo } = await servicoDoPortalFornecedor.gerarPdfPedido(token)

  resposta.header('Content-Disposition', `attachment; filename="${nomeArquivo}"`)
  return resposta.type('application/pdf').send(buffer)
}

async function upload(requisicao: FastifyRequest, resposta: FastifyReply) {
  const token = extrairTokenDaSessao(requisicao)
  const resultado = esquemaUploadPortalFornecedor.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const dados = await servicoDoPortalFornecedor.registrarUpload(token, resultado.data)
  return resposta.status(201).send(dados)
}

export const controladorDoPortalFornecedor = {
  login,
  buscarPedido,
  baixarExcelPedido,
  baixarPdfPedido,
  upload,
}
