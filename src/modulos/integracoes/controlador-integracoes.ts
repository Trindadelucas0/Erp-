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

export const controladorDeIntegracoes = {
  consultarCnpj,
}
