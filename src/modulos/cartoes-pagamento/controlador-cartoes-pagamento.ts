import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeCartoesPagamento } from './servico-cartoes-pagamento.js'
import {
  esquemaDeAtivarCartao,
  esquemaDeCriacaoDeCartao,
  esquemaDeEdicaoDeCartao,
  esquemaFiltroListagemCartoes,
} from './esquema-cartoes-pagamento.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroListagemCartoes.safeParse(requisicao.query)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const cartoes = await servicoDeCartoesPagamento.listar(companyId(requisicao), {
    q: parse.data.q,
    incluirInativos: parse.data.incluirInativos,
    adquirenteId: parse.data.adquirenteId,
    bandeira: parse.data.bandeira,
    tipo: parse.data.tipo,
  })
  return resposta.send({ cartoes })
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const cartao = await servicoDeCartoesPagamento.obter(companyId(requisicao), id)
  return resposta.send({ cartao })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeCartao.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const cartao = await servicoDeCartoesPagamento.criar(
    companyId(requisicao),
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ cartao })
}

async function editar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeCartao.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const cartao = await servicoDeCartoesPagamento.editar(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ cartao })
}

async function alterarStatus(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarCartao.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const cartao = await servicoDeCartoesPagamento.alterarStatus(
    companyId(requisicao),
    id,
    resultado.data.ativo,
    requisicao.idDoUsuario!
  )
  return resposta.send({ cartao })
}

export const controladorDeCartoesPagamento = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
}
