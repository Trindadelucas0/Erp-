/**
 * Controlador de empresas — recebe requisições HTTP e chama o serviço.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeEmpresas } from './servico-empresas.js'
import {
  esquemaDeAtivarEmpresa,
  esquemaDeCriacaoDeEmpresa,
  esquemaDeEdicaoDeEmpresa,
} from './esquema-empresas.js'

async function listarEmpresas(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const idDoUsuario = requisicao.idDoUsuario!
  const empresas = await servicoDeEmpresas.listarEmpresasParaUsuario(idDoUsuario)
  return resposta.send({ empresas })
}

async function criarEmpresa(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeEmpresa.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const empresaCriada = await servicoDeEmpresas.criarEmpresa(
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ empresa: empresaCriada })
}

async function editarEmpresa(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const idDoUsuario = requisicao.idDoUsuario!
  const resultado = esquemaDeEdicaoDeEmpresa.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const empresaAtualizada = await servicoDeEmpresas.editarEmpresa(
    idDoUsuario,
    id,
    resultado.data
  )
  return resposta.send({ empresa: empresaAtualizada })
}

async function alterarStatusDaEmpresa(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const idDoUsuario = requisicao.idDoUsuario!
  const resultado = esquemaDeAtivarEmpresa.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const empresa = await servicoDeEmpresas.alterarStatusDaEmpresa(
    idDoUsuario,
    id,
    resultado.data.ativo
  )
  return resposta.send({ empresa })
}

export const controladorDeEmpresas = {
  listarEmpresas,
  criarEmpresa,
  editarEmpresa,
  alterarStatusDaEmpresa,
}
