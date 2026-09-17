import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeRequisicoesWms } from './servico-requisicoes-wms.js'
import {
  esquemaAtribuir,
  esquemaConferir,
  esquemaCorpoRequisicao,
  esquemaEdicaoRequisicao,
  esquemaFiltroListagem,
  esquemaMotivo,
} from './esquema-requisicoes-wms.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

function usuarioId(requisicao: FastifyRequest) {
  return requisicao.idDoUsuario!
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const query = esquemaFiltroListagem.safeParse(requisicao.query)
  if (!query.success) {
    throw new ErroDaAplicacao(query.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const dados = await servicoDeRequisicoesWms.listar(
    companyId(requisicao),
    usuarioId(requisicao),
    query.data
  )
  return resposta.send(dados)
}

async function listarOperadores(requisicao: FastifyRequest, resposta: FastifyReply) {
  const operadores = await servicoDeRequisicoesWms.listarOperadores(companyId(requisicao))
  return resposta.send({ operadores })
}

async function buscar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const requisicaoWms = await servicoDeRequisicoesWms.buscar(companyId(requisicao), id)
  return resposta.send({ requisicao: requisicaoWms })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const body = esquemaCorpoRequisicao.safeParse(requisicao.body)
  if (!body.success) {
    throw new ErroDaAplicacao(body.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const criado = await servicoDeRequisicoesWms.criar(
    companyId(requisicao),
    usuarioId(requisicao),
    body.data
  )
  return resposta.status(201).send({ requisicao: criado })
}

async function editar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const body = esquemaEdicaoRequisicao.safeParse(requisicao.body)
  if (!body.success) {
    throw new ErroDaAplicacao(body.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const atualizado = await servicoDeRequisicoesWms.editar(
    companyId(requisicao),
    id,
    usuarioId(requisicao),
    body.data
  )
  return resposta.send({ requisicao: atualizado })
}

function acaoSemCorpo(acao: 'disponibilizar' | 'iniciar' | 'pausar' | 'retomar' | 'concluir' | 'desbloquear') {
  return async (requisicao: FastifyRequest, resposta: FastifyReply) => {
    const { id } = requisicao.params as { id: string }
    const atualizado = await servicoDeRequisicoesWms.transicionar({
      companyId: companyId(requisicao),
      id,
      usuarioId: usuarioId(requisicao),
      acao,
    })
    return resposta.send({ requisicao: atualizado })
  }
}

async function atribuir(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const body = esquemaAtribuir.safeParse(requisicao.body)
  if (!body.success) {
    throw new ErroDaAplicacao(body.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const atualizado = await servicoDeRequisicoesWms.transicionar({
    companyId: companyId(requisicao),
    id,
    usuarioId: usuarioId(requisicao),
    acao: 'atribuir',
    responsavelId: body.data.usuarioId,
  })
  return resposta.send({ requisicao: atualizado })
}

async function conferir(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const body = esquemaConferir.safeParse(requisicao.body)
  if (!body.success) {
    throw new ErroDaAplicacao(body.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const atualizado = await servicoDeRequisicoesWms.conferir(
    companyId(requisicao),
    id,
    usuarioId(requisicao),
    body.data
  )
  return resposta.send({ requisicao: atualizado })
}

function acaoComMotivo(acao: 'cancelar' | 'bloquear') {
  return async (requisicao: FastifyRequest, resposta: FastifyReply) => {
    const { id } = requisicao.params as { id: string }
    const body = esquemaMotivo.safeParse(requisicao.body)
    if (!body.success) {
      throw new ErroDaAplicacao(body.error.errors[0]?.message ?? 'Informe o motivo', 400)
    }
    const atualizado = await servicoDeRequisicoesWms.transicionar({
      companyId: companyId(requisicao),
      id,
      usuarioId: usuarioId(requisicao),
      acao,
      motivo: body.data.motivo,
    })
    return resposta.send({ requisicao: atualizado })
  }
}

export const controladorDeRequisicoesWms = {
  listar,
  listarOperadores,
  buscar,
  criar,
  editar,
  disponibilizar: acaoSemCorpo('disponibilizar'),
  iniciar: acaoSemCorpo('iniciar'),
  pausar: acaoSemCorpo('pausar'),
  retomar: acaoSemCorpo('retomar'),
  concluir: acaoSemCorpo('concluir'),
  desbloquear: acaoSemCorpo('desbloquear'),
  atribuir,
  conferir,
  cancelar: acaoComMotivo('cancelar'),
  bloquear: acaoComMotivo('bloquear'),
}
