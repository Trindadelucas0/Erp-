import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  esquemaBaixaLote,
  esquemaDeCriacaoDeContaPagar,
  esquemaDeEdicaoDeContaPagar,
  esquemaFiltroHistoricoBaixas,
  esquemaFiltroListagemContasPagar,
} from './esquema-contas-a-pagar.js'
import { servicoDeContasAPagar } from './servico-contas-a-pagar.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroListagemContasPagar.safeParse(requisicao.query ?? {})
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const contas = await servicoDeContasAPagar.listar(companyId(requisicao), parse.data)
  return resposta.send({ contas })
}

async function listarParaBaixar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroListagemContasPagar.safeParse(requisicao.query ?? {})
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const contas = await servicoDeContasAPagar.listarParaBaixar(companyId(requisicao), parse.data)
  return resposta.send({ contas })
}

async function listarHistoricoBaixas(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroHistoricoBaixas.safeParse(requisicao.query ?? {})
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const baixas = await servicoDeContasAPagar.listarHistoricoBaixas(
    companyId(requisicao),
    parse.data
  )
  return resposta.send({ baixas })
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const conta = await servicoDeContasAPagar.obter(companyId(requisicao), id)
  return resposta.send({ conta })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaDeCriacaoDeContaPagar.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const conta = await servicoDeContasAPagar.criar(
    companyId(requisicao),
    parse.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ conta })
}

async function editar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const parse = esquemaDeEdicaoDeContaPagar.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const conta = await servicoDeContasAPagar.editar(
    companyId(requisicao),
    id,
    parse.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ conta })
}

async function excluir(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = await servicoDeContasAPagar.excluir(
    companyId(requisicao),
    id,
    requisicao.idDoUsuario!
  )
  return resposta.send(resultado)
}

async function baixar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaBaixaLote.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados de baixa inválidos', 400)
  }
  const resultado = await servicoDeContasAPagar.baixar(
    companyId(requisicao),
    requisicao.idDoUsuario!,
    parse.data
  )
  return resposta.status(201).send(resultado)
}

export const controladorDeContasAPagar = {
  listar,
  listarParaBaixar,
  listarHistoricoBaixas,
  obter,
  criar,
  editar,
  excluir,
  baixar,
}
