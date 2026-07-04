/**
 * Controlador de créditos e pendências de fornecedor.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { mensagemErroZod } from '../produtos/esquema-produtos.js'
import {
  esquemaCriarCredito,
  esquemaCriarPendencia,
  esquemaResolverPendencia,
} from './esquema-creditos-pendencias.js'
import { servicoCreditosPendencias } from './servico-creditos-pendencias.js'

async function listarCreditos(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const { fornecedorId, comMovimentos } = requisicao.query as {
    fornecedorId?: string
    comMovimentos?: string
  }
  const creditos = await servicoCreditosPendencias.listarCreditos(companyId, fornecedorId, {
    comMovimentos: comMovimentos === 'true',
  })
  return resposta.send({ creditos })
}

async function criarCredito(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaCriarCredito.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }
  const companyId = requisicao.empresaAtivaId || ''
  const credito = await servicoCreditosPendencias.criarCredito(resultado.data, companyId)
  return resposta.status(201).send({ credito })
}

async function listarPendencias(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const { fornecedorId, todas } = requisicao.query as { fornecedorId?: string; todas?: string }
  const pendencias = await servicoCreditosPendencias.listarPendencias(
    companyId,
    fornecedorId,
    todas !== 'true'
  )
  return resposta.send({ pendencias })
}

async function criarPendencia(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaCriarPendencia.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }
  const companyId = requisicao.empresaAtivaId || ''
  const pendencia = await servicoCreditosPendencias.criarPendencia(resultado.data, companyId)
  return resposta.status(201).send({ pendencia })
}

async function resolverPendencia(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaResolverPendencia.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }
  const companyId = requisicao.empresaAtivaId || ''
  const pendencia = await servicoCreditosPendencias.resolverPendencia(
    id,
    resultado.data.resolvido,
    companyId
  )
  return resposta.send({ pendencia })
}

export const controladorCreditosPendencias = {
  listarCreditos,
  criarCredito,
  listarPendencias,
  criarPendencia,
  resolverPendencia,
}
