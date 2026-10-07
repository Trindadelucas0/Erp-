import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeContas } from './servico-contas.js'
import {
  esquemaDeAtivarConta,
  esquemaDeCriacaoDeConta,
  esquemaDeEdicaoDeConta,
  esquemaFiltroListagemContas,
} from './esquema-contas.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroListagemContas.safeParse(requisicao.query)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const contas = await servicoDeContas.listar(companyId(requisicao), {
    q: parse.data.q,
    incluirInativos: parse.data.incluirInativos,
    somenteAtivos: parse.data.somenteAtivos,
  })
  return resposta.send({ contas })
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const conta = await servicoDeContas.obter(companyId(requisicao), id)
  return resposta.send({ conta })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeConta.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const conta = await servicoDeContas.criar(
    companyId(requisicao),
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ conta })
}

async function editar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeConta.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const conta = await servicoDeContas.editar(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ conta })
}

async function alterarStatus(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarConta.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const conta = await servicoDeContas.alterarStatus(
    companyId(requisicao),
    id,
    resultado.data.ativo,
    requisicao.idDoUsuario!
  )
  return resposta.send({ conta })
}

export const controladorDeContas = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
}
