import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeRecorrenciasFinanceiras } from './servico-recorrencias-financeiras.js'
import {
  esquemaDeAtivarRecorrencia,
  esquemaDeCriacaoDeRecorrencia,
  esquemaDeEdicaoDeRecorrencia,
  esquemaFiltroListagemRecorrencias,
} from './esquema-recorrencias-financeiras.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroListagemRecorrencias.safeParse(requisicao.query)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const recorrencias = await servicoDeRecorrenciasFinanceiras.listar(companyId(requisicao), {
    q: parse.data.q,
    incluirInativos: parse.data.incluirInativos,
    fornecedorPessoaId: parse.data.fornecedorPessoaId,
  })
  return resposta.send({ recorrencias })
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const recorrencia = await servicoDeRecorrenciasFinanceiras.obter(companyId(requisicao), id)
  return resposta.send({ recorrencia })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeRecorrencia.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const recorrencia = await servicoDeRecorrenciasFinanceiras.criar(
    companyId(requisicao),
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ recorrencia })
}

async function editar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeRecorrencia.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const recorrencia = await servicoDeRecorrenciasFinanceiras.editar(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ recorrencia })
}

async function alterarStatus(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarRecorrencia.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const recorrencia = await servicoDeRecorrenciasFinanceiras.alterarStatus(
    companyId(requisicao),
    id,
    resultado.data.ativo,
    requisicao.idDoUsuario!
  )
  return resposta.send({ recorrencia })
}

export const controladorDeRecorrenciasFinanceiras = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
}
