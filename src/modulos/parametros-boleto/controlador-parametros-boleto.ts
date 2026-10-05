import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  esquemaAtivarParametroBoleto,
  esquemaFiltroListagemParametrosBoleto,
  esquemaGravarParametrosBoleto,
} from './esquema-parametros-boleto.js'
import { servicoParametrosBoleto } from './servico-parametros-boleto.js'

function companyId(requisicao: FastifyRequest): string {
  const id = requisicao.empresaAtivaId
  if (!id) throw new ErroDaAplicacao('Empresa ativa não informada', 400)
  return id
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroListagemParametrosBoleto.safeParse(requisicao.query)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const parametros = await servicoParametrosBoleto.listar(companyId(requisicao), {
    q: parse.data.q,
    incluirInativos: parse.data.incluirInativos,
    somenteAtivos: parse.data.somenteAtivos,
  })
  return resposta.send({ parametros })
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const parametro = await servicoParametrosBoleto.obter(companyId(requisicao), id)
  return resposta.send({ parametro })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaGravarParametrosBoleto.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const parametro = await servicoParametrosBoleto.criar(companyId(requisicao), parse.data)
  return resposta.status(201).send({ parametro })
}

async function editar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const parse = esquemaGravarParametrosBoleto.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const parametro = await servicoParametrosBoleto.editar(
    companyId(requisicao),
    id,
    parse.data
  )
  return resposta.send({ parametro })
}

async function alterarAtivo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const parse = esquemaAtivarParametroBoleto.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const parametro = await servicoParametrosBoleto.alterarAtivo(
    companyId(requisicao),
    id,
    parse.data.ativo
  )
  return resposta.send({ parametro })
}

async function marcarPadrao(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const parametro = await servicoParametrosBoleto.marcarPadrao(companyId(requisicao), id)
  return resposta.send({ parametro })
}

async function testarConexao(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = await servicoParametrosBoleto.testarConexao(companyId(requisicao), id)
  return resposta.send(resultado)
}

export const controladorParametrosBoleto = {
  listar,
  obter,
  criar,
  editar,
  alterarAtivo,
  marcarPadrao,
  testarConexao,
}
