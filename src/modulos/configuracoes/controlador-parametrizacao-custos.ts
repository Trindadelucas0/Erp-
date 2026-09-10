import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoParametrizacaoCustos } from './servico-parametrizacao-custos.js'
import { esquemaGravarParametrizacaoCustos } from './esquema-parametrizacao-custos.js'

function companyIdOu400(requisicao: FastifyRequest): string {
  const id = requisicao.empresaAtivaId
  if (!id) throw new ErroDaAplicacao('Empresa ativa não informada', 400)
  return id
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parametrizacao = await servicoParametrizacaoCustos.obter(companyIdOu400(requisicao))
  return resposta.send({ parametrizacao })
}

async function gravar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaGravarParametrizacaoCustos.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const usuarioId = requisicao.idDoUsuario
  if (!usuarioId) throw new ErroDaAplicacao('Não autenticado', 401)
  const parametrizacao = await servicoParametrizacaoCustos.gravar(
    companyIdOu400(requisicao),
    parse.data,
    usuarioId
  )
  return resposta.send({ parametrizacao })
}

export const controladorParametrizacaoCustos = {
  obter,
  gravar,
}
