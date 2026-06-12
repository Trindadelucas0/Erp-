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
  esquemaDeResetDeSenha,
} from './esquema-usuarios.js'

async function criarUsuario(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeUsuario.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const usuarioCriado = await servicoDeUsuarios.criarUsuario(
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ usuario: usuarioCriado })
}

async function editarUsuario(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeUsuario.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const usuarioAtualizado = await servicoDeUsuarios.editarUsuario(
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )

  return resposta.send({ usuario: usuarioAtualizado })
}

async function alterarStatusDoUsuario(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarUsuario.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const idDoUsuarioLogado = requisicao.idDoUsuario!

  const usuario = await servicoDeUsuarios.alterarStatusDoUsuario(
    id,
    resultado.data.ativo,
    idDoUsuarioLogado
  )

  return resposta.send({ usuario })
}

async function listarUsuarios(
  _requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const listaDeUsuarios = await servicoDeUsuarios.listarUsuarios()
  return resposta.send({ usuarios: listaDeUsuarios })
}

async function buscarUsuarioPorId(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const usuarioEncontrado = await servicoDeUsuarios.buscarUsuarioPorId(id)
  return resposta.send({ usuario: usuarioEncontrado })
}

async function resetarSenha(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeResetDeSenha.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  await servicoDeUsuarios.resetarSenhaPorAdmin(
    id,
    resultado.data.novaSenha,
    requisicao.idDoUsuario!
  )
  return resposta.send({ mensagem: 'Senha redefinida com sucesso' })
}

export const controladorDeUsuarios = {
  criarUsuario,
  editarUsuario,
  alterarStatusDoUsuario,
  listarUsuarios,
  buscarUsuarioPorId,
  resetarSenha,
}
