import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { esquemaListagemPendencias } from './esquema-pendencias.js'
import { servicoDePendencias } from './servico-pendencias.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaListagemPendencias.safeParse(requisicao.query ?? {})
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const lista = await servicoDePendencias.listar({
    companyId: companyId(requisicao),
    idDoUsuario: requisicao.idDoUsuario!,
    tela: parse.data.tela,
    limite: parse.data.limite,
    pagina: parse.data.pagina,
  })
  return resposta.send(lista)
}

async function resumo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoDePendencias.resumo({
    companyId: companyId(requisicao),
    idDoUsuario: requisicao.idDoUsuario!,
  })
  return resposta.send(dados)
}

export const controladorDePendencias = {
  listar,
  resumo,
}
