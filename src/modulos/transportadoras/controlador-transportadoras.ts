/**
 * Controlador de transportadoras — recebe requisições HTTP e chama o serviço.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeTransportadoras } from './servico-transportadoras.js'
import {
  esquemaDeAtivarTransportadora,
  esquemaDeCriacaoDeTransportadora,
  esquemaDeEdicaoDeTransportadora,
} from './esquema-transportadoras.js'

async function listarTransportadoras(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const companyId = requisicao.empresaAtivaId || ''
  const transportadoras = await servicoDeTransportadoras.listarTransportadoras(companyId)
  return resposta.send({ transportadoras })
}

async function criarTransportadora(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const resultado = esquemaDeCriacaoDeTransportadora.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const transportadora = await servicoDeTransportadoras.criarTransportadora(
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )

  return resposta.status(201).send({ transportadora })
}

async function editarTransportadora(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeTransportadora.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const transportadora = await servicoDeTransportadoras.editarTransportadora(
    id,
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )

  return resposta.send({ transportadora })
}

async function alterarStatusDaTransportadora(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarTransportadora.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const transportadora = await servicoDeTransportadoras.alterarStatusDaTransportadora(
    id,
    resultado.data.ativo,
    companyId,
    requisicao.idDoUsuario!
  )

  return resposta.send({ transportadora })
}

async function buscarTransportadoraPorDocumento(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { documento } = requisicao.params as { documento: string }
  const companyId = requisicao.empresaAtivaId || ''
  const resultado = await servicoDeTransportadoras.buscarTransportadoraPorDocumento(documento, companyId)
  return resposta.send(resultado)
}

export const controladorDeTransportadoras = {
  listarTransportadoras,
  criarTransportadora,
  editarTransportadora,
  alterarStatusDaTransportadora,
  buscarTransportadoraPorDocumento,
}
