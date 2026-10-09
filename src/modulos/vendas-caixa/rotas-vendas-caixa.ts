import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import {
  esquemaChamarAtendente,
  esquemaConfirmarChamado,
  esquemaConfirmarPagamento,
  esquemaReceberOrcamento,
} from './esquema-vendas-caixa.js'
import { servicoDeVendasCaixa } from './servico-vendas-caixa.js'

function companyIdDaSessao(requisicao: FastifyRequest): string {
  const companyId = requisicao.empresaAtivaId
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa obrigatória', 400)
  return companyId
}

function usuarioIdDaSessao(requisicao: FastifyRequest): string {
  const usuarioId = requisicao.idDoUsuario
  if (!usuarioId) throw new ErroDaAplicacao('Não autenticado', 401)
  return usuarioId
}

function idOrcamentoDaUrl(requisicao: FastifyRequest): string {
  const { id } = requisicao.params as { id?: string }
  if (!id || !z.string().uuid().safeParse(id).success) {
    throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  }
  return id
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const lista = await servicoDeVendasCaixa.listar(companyIdDaSessao(requisicao))
  return resposta.send(lista)
}

async function listarAReceber(requisicao: FastifyRequest, resposta: FastifyReply) {
  const lista = await servicoDeVendasCaixa.listarAReceber(companyIdDaSessao(requisicao))
  return resposta.send(lista)
}

async function chavePix(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoDeVendasCaixa.obterChavePix(companyIdDaSessao(requisicao))
  return resposta.send(dados)
}

async function opcoesTotem(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoDeVendasCaixa.obterOpcoesTotem(companyIdDaSessao(requisicao))
  return resposta.send(dados)
}

async function buscarOrcamentos(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { termo } = requisicao.query as { termo?: string }
  const limpo = termo?.trim() ?? ''
  if (!limpo) {
    return resposta.send({ orcamentos: [] })
  }
  const resultado = await servicoDeVendasCaixa.buscarOrcamentos(companyIdDaSessao(requisicao), limpo)
  return resposta.send(resultado)
}

async function obterOrcamento(requisicao: FastifyRequest, resposta: FastifyReply) {
  const id = idOrcamentoDaUrl(requisicao)
  const detalhe = await servicoDeVendasCaixa.obterOrcamentoRecebimento(
    companyIdDaSessao(requisicao),
    id
  )
  return resposta.send(detalhe)
}

async function confirmar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const corpo = esquemaConfirmarPagamento.safeParse(requisicao.body)
  if (!corpo.success) {
    throw new ErroDaAplicacao(corpo.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const venda = await servicoDeVendasCaixa.confirmarPagamento(
    companyIdDaSessao(requisicao),
    usuarioIdDaSessao(requisicao),
    corpo.data
  )
  return resposta.status(201).send({ venda })
}

async function chamar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const corpo = esquemaChamarAtendente.safeParse(requisicao.body)
  if (!corpo.success) {
    throw new ErroDaAplicacao(corpo.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const venda = await servicoDeVendasCaixa.chamarAtendente(
    companyIdDaSessao(requisicao),
    corpo.data
  )
  return resposta.status(201).send({ venda })
}

async function receberOrcamento(requisicao: FastifyRequest, resposta: FastifyReply) {
  const id = idOrcamentoDaUrl(requisicao)
  const corpo = esquemaReceberOrcamento.safeParse(requisicao.body)
  if (!corpo.success) {
    throw new ErroDaAplicacao(corpo.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const resultado = await servicoDeVendasCaixa.receberOrcamento(
    companyIdDaSessao(requisicao),
    usuarioIdDaSessao(requisicao),
    id,
    corpo.data
  )
  return resposta.status(201).send(resultado)
}

async function chamarOrcamento(requisicao: FastifyRequest, resposta: FastifyReply) {
  const id = idOrcamentoDaUrl(requisicao)
  const venda = await servicoDeVendasCaixa.chamarOrcamento(companyIdDaSessao(requisicao), id)
  return resposta.status(201).send({ venda })
}

async function confirmarChamado(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  if (!id) throw new ErroDaAplicacao('Venda não encontrada', 404)
  const corpo = esquemaConfirmarChamado.safeParse(requisicao.body)
  if (!corpo.success) {
    throw new ErroDaAplicacao(corpo.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const venda = await servicoDeVendasCaixa.confirmarChamado(
    companyIdDaSessao(requisicao),
    usuarioIdDaSessao(requisicao),
    id,
    corpo.data
  )
  return resposta.send({ venda })
}

export async function rotasDeVendasCaixa(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]
  aplicacao.get('/', { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] }, listar)
  aplicacao.get(
    '/a-receber',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] },
    listarAReceber
  )
  aplicacao.get(
    '/chave-pix',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] },
    chavePix
  )
  aplicacao.get(
    '/opcoes-totem',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] },
    opcoesTotem
  )
  aplicacao.get(
    '/orcamentos/busca',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] },
    buscarOrcamentos
  )
  aplicacao.get(
    '/orcamentos/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] },
    obterOrcamento
  )
  aplicacao.post('/', { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] }, confirmar)
  aplicacao.post(
    '/chamar',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] },
    chamar
  )
  aplicacao.post(
    '/orcamentos/:id',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] },
    receberOrcamento
  )
  aplicacao.post(
    '/orcamentos/:id/chamar',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] },
    chamarOrcamento
  )
  aplicacao.post(
    '/:id/confirmar',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] },
    confirmarChamado
  )
}
