import type { FastifyRequest, FastifyReply } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { esquemaRegrasFiscais } from './esquema-regras-fiscais.js'
import { servicoRegrasFiscais } from './servico-regras-fiscais.js'

function empresa(requisicao: FastifyRequest) {
  if (!requisicao.empresaAtivaId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)
  return requisicao.empresaAtivaId
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  return resposta.send({ regras: await servicoRegrasFiscais.obter(empresa(requisicao)) })
}

async function gravar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaRegrasFiscais.safeParse(requisicao.body)
  if (!parse.success) throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados inválidos', 400)
  if (!requisicao.idDoUsuario) throw new ErroDaAplicacao('Não autenticado', 401)
  return resposta.send({ regras: await servicoRegrasFiscais.gravar(empresa(requisicao), parse.data, requisicao.idDoUsuario) })
}

export const controladorRegrasFiscais = { obter, gravar }
