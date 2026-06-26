import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { repositorioDeGruposEconomicos } from './repositorio-grupos-economicos.js'

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const q = (requisicao.query as { q?: string }).q
  const grupos = await repositorioDeGruposEconomicos.listar(companyId, q)
  return resposta.send({ grupos })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const schema = z.object({ nome: z.string().min(1).max(200) })
  const { nome } = schema.parse(requisicao.body)
  const companyId = requisicao.empresaAtivaId || ''
  const grupo = await repositorioDeGruposEconomicos.criar(companyId, nome)
  return resposta.status(201).send({ grupo })
}

export const controladorDeGruposEconomicos = { listar, criar }
