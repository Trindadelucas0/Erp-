/**
 * Controlador de clientes — recebe requisições HTTP e chama o serviço.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeClientes } from './servico-clientes.js'
import {
  esquemaDeAtivarCliente,
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
  const cliente = await servicoDeClientes.editarCliente(
    id,
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )

  return resposta.send({ cliente })
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

export const controladorDeClientes = {
  listarClientes,
  criarCliente,
  editarCliente,
  alterarStatusDoCliente,
}
