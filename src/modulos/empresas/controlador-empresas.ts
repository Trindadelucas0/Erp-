/**
 * Controlador de empresas — recebe requisições HTTP e chama o serviço.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
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
    return resposta
      .status(400)
      .send({ mensagem: resultado.error.errors[0].message })
  }

  const empresaCriada = await servicoDeEmpresas.criarEmpresa(resultado.data)
  return resposta.status(201).send({ empresa: empresaCriada })
}

async function editarEmpresa(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeEmpresa.safeParse(requisicao.body)

  if (!resultado.success) {
    return resposta
      .status(400)
      .send({ mensagem: resultado.error.errors[0].message })
  }

  const empresaAtualizada = await servicoDeEmpresas.editarEmpresa(
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
  const resultado = esquemaDeAtivarEmpresa.safeParse(requisicao.body)

  if (!resultado.success) {
    return resposta
      .status(400)
      .send({ mensagem: resultado.error.errors[0].message })
  }

  const empresa = await servicoDeEmpresas.alterarStatusDaEmpresa(
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
