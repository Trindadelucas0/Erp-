import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDePlanosFinanceiros } from './servico-planos-financeiros.js'
import {
  esquemaDeAtivarPlanoFinanceiro,
  esquemaDeCriacaoDePlanoFinanceiro,
  esquemaDeEdicaoDePlanoFinanceiro,
  esquemaDeMoverPlanoFinanceiro,
} from './esquema-planos-financeiros.js'
import type { TipoPlanoFinanceiro } from './codigo-plano-financeiro.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listarPlanosFinanceiros(requisicao: FastifyRequest, resposta: FastifyReply) {
  const query = requisicao.query as {
    q?: string
    tipo?: string
    incluirInativos?: string
  }

  const incluirInativos = query.incluirInativos === 'true'
  const tipo = query.tipo as TipoPlanoFinanceiro | undefined

  if (incluirInativos) {
    const resultado = await servicoDePlanosFinanceiros.listarParaGestao(
      companyId(requisicao),
      tipo,
      true,
      query.q
    )
    return resposta.send(resultado)
  }

  const planos = await servicoDePlanosFinanceiros.listarParaCatalogo(
    companyId(requisicao),
    query.q,
    tipo
  )
  return resposta.send({ planos })
}

async function sugerirProximoCodigo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const query = requisicao.query as { tipo?: string; parentId?: string }
  const tipo = query.tipo as TipoPlanoFinanceiro

  if (!tipo || (tipo !== 'receita' && tipo !== 'despesa' && tipo !== 'resultado')) {
    throw new ErroDaAplicacao('Parâmetro tipo é obrigatório (receita, despesa ou resultado)', 400)
  }

  const codigo = await servicoDePlanosFinanceiros.sugerirProximoCodigo(
    companyId(requisicao),
    tipo,
    query.parentId || null
  )
  return resposta.send({ codigo })
}

async function buscarPlanoFinanceiro(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const plano = await servicoDePlanosFinanceiros.buscarPorId(companyId(requisicao), id)
  return resposta.send({ plano })
}

async function criarPlanoFinanceiro(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDePlanoFinanceiro.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const plano = await servicoDePlanosFinanceiros.criarPlano(
    companyId(requisicao),
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ plano })
}

async function editarPlanoFinanceiro(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDePlanoFinanceiro.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const plano = await servicoDePlanosFinanceiros.editarPlano(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ plano })
}

async function alterarStatusDoPlanoFinanceiro(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarPlanoFinanceiro.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const plano = await servicoDePlanosFinanceiros.alterarStatus(
    companyId(requisicao),
    id,
    resultado.data.ativo,
    requisicao.idDoUsuario!
  )
  return resposta.send({ plano })
}

async function moverPlanoFinanceiro(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeMoverPlanoFinanceiro.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const plano = await servicoDePlanosFinanceiros.moverPlano(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ plano })
}

export const controladorDePlanosFinanceiros = {
  listarPlanosFinanceiros,
  sugerirProximoCodigo,
  buscarPlanoFinanceiro,
  criarPlanoFinanceiro,
  editarPlanoFinanceiro,
  alterarStatusDoPlanoFinanceiro,
  moverPlanoFinanceiro,
}
