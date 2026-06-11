/**
 * Controlador de usuários — recebe a requisição HTTP e chama o serviço.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeUsuarios } from './servico-usuarios.js'
import {
  esquemaDeCriacaoDeUsuario,
  esquemaDeEdicaoDeUsuario,
  esquemaDeAtivarUsuario,
} from './esquema-usuarios.js'

/**
 * Cria um novo usuário.
 */
async function criarUsuario(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeUsuario.safeParse(requisicao.body)

  if (!resultado.success) {
    return resposta
      .status(400)
      .send({ mensagem: resultado.error.errors[0].message })
  }

  const usuarioCriado = await servicoDeUsuarios.criarUsuario(resultado.data)
  return resposta.status(201).send({ usuario: usuarioCriado })
}

/**
 * Edita um usuário existente.
 */
async function editarUsuario(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeUsuario.safeParse(requisicao.body)

  if (!resultado.success) {
    return resposta
      .status(400)
      .send({ mensagem: resultado.error.errors[0].message })
  }

  const usuarioAtualizado = await servicoDeUsuarios.editarUsuario(
    id,
    resultado.data
  )

  return resposta.send({ usuario: usuarioAtualizado })
}

/**
 * Ativa ou desativa um usuário.
 */
async function alterarStatusDoUsuario(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarUsuario.safeParse(requisicao.body)

  if (!resultado.success) {
    return resposta
      .status(400)
      .send({ mensagem: resultado.error.errors[0].message })
  }

  const idDoUsuarioLogado = requisicao.idDoUsuario!

  const usuario = await servicoDeUsuarios.alterarStatusDoUsuario(
    id,
    resultado.data.ativo,
    idDoUsuarioLogado
  )

  return resposta.send({ usuario })
}

/**
 * Lista todos os usuários.
 */
async function listarUsuarios(
  _requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const listaDeUsuarios = await servicoDeUsuarios.listarUsuarios()
  return resposta.send({ usuarios: listaDeUsuarios })
}

/**
 * Busca usuário por ID.
 */
async function buscarUsuarioPorId(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const usuarioEncontrado = await servicoDeUsuarios.buscarUsuarioPorId(id)
  return resposta.send({ usuario: usuarioEncontrado })
}

export const controladorDeUsuarios = {
  criarUsuario,
  editarUsuario,
  alterarStatusDoUsuario,
  listarUsuarios,
  buscarUsuarioPorId,
}
