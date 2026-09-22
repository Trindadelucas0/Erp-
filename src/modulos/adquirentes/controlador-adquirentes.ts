import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeAdquirentes } from './servico-adquirentes.js'
import {
  esquemaDeAtivarAdquirente,
  esquemaDeCriacaoDeAdquirente,
  esquemaDeEdicaoDeAdquirente,
  esquemaFiltroListagemAdquirentes,
} from './esquema-adquirentes.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroListagemAdquirentes.safeParse(requisicao.query)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const adquirentes = await servicoDeAdquirentes.listar(companyId(requisicao), {
    q: parse.data.q,
    incluirInativos: parse.data.incluirInativos,
    somenteAtivos: parse.data.somenteAtivos,
  })
  return resposta.send({ adquirentes })
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const adquirente = await servicoDeAdquirentes.obter(companyId(requisicao), id)
  return resposta.send({ adquirente })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeAdquirente.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const adquirente = await servicoDeAdquirentes.criar(
    companyId(requisicao),
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ adquirente })
}

async function editar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeAdquirente.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const adquirente = await servicoDeAdquirentes.editar(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ adquirente })
}

async function alterarStatus(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarAdquirente.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const adquirente = await servicoDeAdquirentes.alterarStatus(
    companyId(requisicao),
    id,
    resultado.data.ativo,
    requisicao.idDoUsuario!
  )
  return resposta.send({ adquirente })
}

export const controladorDeAdquirentes = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
}
