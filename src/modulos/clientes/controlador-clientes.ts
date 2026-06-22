/**
 * Controlador de clientes — recebe requisições HTTP e chama o serviço.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioDePermissoes } from '../../modulos/permissoes/repositorio-permissoes.js'
import { servicoDeClientes } from './servico-clientes.js'
import {
  esquemaDeAprovacaoDeCliente,
  esquemaDeAtivarCliente,
  esquemaDeConfirmacaoDeAssinatura,
  esquemaDeCriacaoDeCliente,
  esquemaDeEdicaoDeCliente,
} from './esquema-clientes.js'

async function listarClientes(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const companyId = requisicao.empresaAtivaId || ''
  const clientes = await servicoDeClientes.listarClientes(companyId)
  return resposta.send({ clientes })
}

async function listarClientesPendentes(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const companyId = requisicao.empresaAtivaId || ''
  const clientes = await servicoDeClientes.listarClientesPendentes(companyId)
  return resposta.send({ clientes })
}

async function criarCliente(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const resultado = esquemaDeCriacaoDeCliente.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const cliente = await servicoDeClientes.criarCliente(
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )

  return resposta.status(201).send({ cliente })
}

async function editarCliente(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeCliente.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const podeAprovar = await repositorioDePermissoes.usuarioPossuiPermissao(
    requisicao.idDoUsuario!,
    'clientes:approve'
  )

  const cliente = await servicoDeClientes.editarCliente(
    id,
    resultado.data,
    companyId,
    requisicao.idDoUsuario!,
    podeAprovar
  )

  return resposta.send({ cliente })
}

async function processarAprovacao(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAprovacaoDeCliente.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const dados = await servicoDeClientes.processarAprovacao(
    id,
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )

  return resposta.send(dados)
}

async function alterarStatusDoCliente(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarCliente.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const cliente = await servicoDeClientes.alterarStatusDoCliente(
    id,
    resultado.data.ativo,
    companyId,
    requisicao.idDoUsuario!
  )

  return resposta.send({ cliente })
}

async function buscarClientePorDocumento(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { documento } = requisicao.params as { documento: string }
  const companyId = requisicao.empresaAtivaId || ''
  const resultado = await servicoDeClientes.buscarClientePorDocumento(documento, companyId)
  return resposta.send(resultado)
}

async function consultarAssinatura(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { token } = requisicao.params as { token: string }
  const resultado = await servicoDeClientes.consultarAssinatura(token)
  return resposta.send(resultado)
}

async function confirmarAssinatura(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const resultado = esquemaDeConfirmacaoDeAssinatura.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const ip =
    (requisicao.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    requisicao.ip

  const dados = await servicoDeClientes.confirmarAssinatura(resultado.data, ip)
  return resposta.send(dados)
}

export const controladorDeClientes = {
  listarClientes,
  listarClientesPendentes,
  criarCliente,
  editarCliente,
  processarAprovacao,
  alterarStatusDoCliente,
  buscarClientePorDocumento,
  consultarAssinatura,
  confirmarAssinatura,
}
