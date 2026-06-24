import type { FastifyReply, FastifyRequest } from 'fastify'
import { repositorioDeCatalogos } from './repositorio-catalogos.js'

async function listarPlanosFinanceiros(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const q = (requisicao.query as { q?: string }).q
  const planos = await repositorioDeCatalogos.listarPlanosFinanceiros(companyId, q)
  return resposta.send({ planos })
}

async function listarCfops(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const query = requisicao.query as { q?: string; tipo?: string }
  const cfops = await repositorioDeCatalogos.listarCfops(
    companyId,
    query.tipo || 'entrada',
    query.q
  )
  return resposta.send({ cfops })
}

export const controladorDeCatalogos = {
  listarPlanosFinanceiros,
  listarCfops,
}
