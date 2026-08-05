import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeCfops } from './servico-cfops.js'
import { esquemaDeCriacaoDeCfop, esquemaDeEdicaoDeCfop } from './esquema-cfops.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listarCfops(requisicao: FastifyRequest, resposta: FastifyReply) {
  const query = requisicao.query as {
    q?: string
    tipo?: string
    subtipo?: string
    incluirInativos?: string
  }

  if (query.incluirInativos === 'true') {
    const cfops = await servicoDeCfops.listarParaGestao(
      companyId(requisicao),
      query.q,
      query.tipo,
      query.subtipo
    )
    return resposta.send({ cfops })
  }

  const cfops = await servicoDeCfops.listarParaCatalogo(
    companyId(requisicao),
    query.q,
    query.tipo || 'entrada',
    query.subtipo
  )
  return resposta.send({ cfops })
}

async function buscarCfop(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const cfop = await servicoDeCfops.buscarPorId(companyId(requisicao), id)
  return resposta.send({ cfop })
}

async function criarCfop(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeCfop.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const cfop = await servicoDeCfops.criarCfop(
    companyId(requisicao),
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ cfop })
}

async function editarCfop(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeCfop.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const cfop = await servicoDeCfops.editarCfop(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ cfop })
}

export const controladorDeCfops = {
  listarCfops,
  buscarCfop,
  criarCfop,
  editarCfop,
}
