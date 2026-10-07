import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { esquemaOrcamento } from './esquema-orcamentos.js'
import { servicoDeOrcamentos } from './servico-orcamentos.js'

function companyIdDaSessao(requisicao: FastifyRequest): string {
  const companyId = requisicao.empresaAtivaId
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa obrigatória', 400)
  return companyId
}

function idDaUrl(requisicao: FastifyRequest): string {
  const { id } = requisicao.params as { id?: string }
  if (!id || !z.string().uuid().safeParse(id).success) {
    throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  }
  return id
}

function lerCorpo(requisicao: FastifyRequest) {
  const resultado = esquemaOrcamento.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  return resultado.data
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const orcamentos = await servicoDeOrcamentos.listar(companyIdDaSessao(requisicao))
  return resposta.send({ orcamentos })
}

async function proximoNumero(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoDeOrcamentos.preenchimentoNovo(companyIdDaSessao(requisicao))
  return resposta.send(dados)
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const orcamento = await servicoDeOrcamentos.obter(companyIdDaSessao(requisicao), idDaUrl(requisicao))
  return resposta.send({ orcamento })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const orcamento = await servicoDeOrcamentos.criar(companyIdDaSessao(requisicao), lerCorpo(requisicao))
  return resposta.status(201).send({ orcamento })
}

async function atualizar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const orcamento = await servicoDeOrcamentos.atualizar(
    companyIdDaSessao(requisicao),
    idDaUrl(requisicao),
    lerCorpo(requisicao)
  )
  return resposta.send({ orcamento })
}

async function finalizar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const orcamento = await servicoDeOrcamentos.finalizar(
    companyIdDaSessao(requisicao),
    idDaUrl(requisicao)
  )
  return resposta.send({ orcamento })
}

async function enviarEmail(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = await servicoDeOrcamentos.enviarEmail(
    companyIdDaSessao(requisicao),
    idDaUrl(requisicao)
  )
  return resposta.send(resultado)
}

export async function rotasDeOrcamentos(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get('/', { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] }, listar)
  aplicacao.get(
    '/proximo-numero',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] },
    proximoNumero
  )
  aplicacao.get('/:id', { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] }, obter)
  aplicacao.post('/', { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] }, criar)
  aplicacao.patch('/:id', { preHandler: [...auth, middlewareDeAutorizacao('vendas:edit')] }, atualizar)
  aplicacao.post(
    '/:id/finalizar',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:edit')] },
    finalizar
  )
  aplicacao.post(
    '/:id/enviar-email',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:edit')] },
    enviarEmail
  )
}
