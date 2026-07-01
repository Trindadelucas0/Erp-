import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeCfops } from './servico-cfops.js'
import {
  esquemaDeAtivarCfop,
  esquemaDeCriacaoDeCfop,
  esquemaDeEdicaoDeCfop,
} from './esquema-cfops.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listarCfops(requisicao: FastifyRequest, resposta: FastifyReply) {
  const query = requisicao.query as { q?: string; tipo?: string; incluirInativos?: string }

  if (query.incluirInativos === 'true') {
    const cfops = await servicoDeCfops.listarParaGestao(
      companyId(requisicao),
      query.q,
      query.tipo
    )
    return resposta.send({ cfops })
  }

  const cfops = await servicoDeCfops.listarParaCatalogo(
    companyId(requisicao),
    query.q,
    query.tipo || 'entrada'
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

async function alterarStatusDoCfop(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarCfop.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const cfop = await servicoDeCfops.alterarStatus(
    companyId(requisicao),
    id,
    resultado.data.ativo,
    requisicao.idDoUsuario!
  )
  return resposta.send({ cfop })
}

export const controladorDeCfops = {
  listarCfops,
  buscarCfop,
  criarCfop,
  editarCfop,
  alterarStatusDoCfop,
}
