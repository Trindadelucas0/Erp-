/**
 * Controlador de fornecedores — recebe requisições HTTP e chama o serviço.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeFornecedores } from './servico-fornecedores.js'
import {
  esquemaDeAtivarFornecedor,
  esquemaDeCriacaoDeFornecedor,
  esquemaDeEdicaoDeFornecedor,
} from './esquema-fornecedores.js'

async function listarFornecedores(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const companyId = requisicao.empresaAtivaId || ''
  const fornecedores = await servicoDeFornecedores.listarFornecedores(companyId)
  return resposta.send({ fornecedores })
}

async function criarFornecedor(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const resultado = esquemaDeCriacaoDeFornecedor.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const fornecedor = await servicoDeFornecedores.criarFornecedor(
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )

  return resposta.status(201).send({ fornecedor })
}

async function editarFornecedor(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeFornecedor.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const fornecedor = await servicoDeFornecedores.editarFornecedor(
    id,
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )

  return resposta.send({ fornecedor })
}

async function alterarStatusDoFornecedor(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarFornecedor.safeParse(requisicao.body)

  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const fornecedor = await servicoDeFornecedores.alterarStatusDoFornecedor(
    id,
    resultado.data.ativo,
    companyId,
    requisicao.idDoUsuario!
  )

  return resposta.send({ fornecedor })
}

async function buscarFornecedorPorDocumento(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const { documento } = requisicao.params as { documento: string }
  const companyId = requisicao.empresaAtivaId || ''
  const resultado = await servicoDeFornecedores.buscarFornecedorPorDocumento(documento, companyId)
  return resposta.send(resultado)
}

export const controladorDeFornecedores = {
  listarFornecedores,
  criarFornecedor,
  editarFornecedor,
  alterarStatusDoFornecedor,
  buscarFornecedorPorDocumento,
}
