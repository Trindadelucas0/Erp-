/**
 * Controlador de integrações externas (BrasilAPI, etc.).
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { servicoBrasilApi } from './servico-brasil-api.js'

async function consultarCnpj(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { documento } = requisicao.params as { documento: string }
  const dados = await servicoBrasilApi.consultarCnpj(documento)
  return resposta.send(dados)
}

async function listarBancos(_requisicao: FastifyRequest, resposta: FastifyReply) {
  const bancos = await servicoBrasilApi.listarBancos()
  return resposta.send({ bancos })
}

export const controladorDeIntegracoes = {
  consultarCnpj,
  listarBancos,
}
