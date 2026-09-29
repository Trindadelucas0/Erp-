import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeTiposVeiculo } from './servico-tipos-veiculo.js'
import {
  esquemaDeAtivarTipoVeiculo,
  esquemaDeCriacaoDeTipoVeiculo,
  esquemaDeEdicaoDeTipoVeiculo,
  esquemaFiltroListagemTiposVeiculo,
} from './esquema-tipos-veiculo.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroListagemTiposVeiculo.safeParse(requisicao.query)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const tiposVeiculo = await servicoDeTiposVeiculo.listar(companyId(requisicao), parse.data)
  return resposta.send({ tiposVeiculo })
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const tipoVeiculo = await servicoDeTiposVeiculo.obter(companyId(requisicao), id)
  return resposta.send({ tipoVeiculo })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeTipoVeiculo.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const tipoVeiculo = await servicoDeTiposVeiculo.criar(
    companyId(requisicao),
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ tipoVeiculo })
}

async function editar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeTipoVeiculo.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const tipoVeiculo = await servicoDeTiposVeiculo.editar(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ tipoVeiculo })
}

async function alterarStatus(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarTipoVeiculo.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const tipoVeiculo = await servicoDeTiposVeiculo.alterarStatus(
    companyId(requisicao),
    id,
    resultado.data.ativo,
    requisicao.idDoUsuario!
  )
  return resposta.send({ tipoVeiculo })
}

export const controladorDeTiposVeiculo = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
}
