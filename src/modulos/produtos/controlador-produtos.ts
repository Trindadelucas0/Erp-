/**
 * Controlador de produtos — recebe requisições HTTP e chama o serviço.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeProdutos } from './servico-produtos.js'
import { servicoDeUnidadesMedida } from './servico-unidades-medida.js'
import {
  esquemaDeAtivarProduto,
  esquemaDeCriacaoDeProduto,
  esquemaDeEdicaoDeProduto,
  esquemaDeUploadFotoProduto,
  mensagemErroZod,
} from './esquema-produtos.js'

async function listarMarcas(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const { q } = requisicao.query as { q?: string }
  const resultado = await servicoDeProdutos.listarMarcas(companyId, q)
  return resposta.send(resultado)
}

async function sugerirProximoSku(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const resultado = await servicoDeProdutos.sugerirProximoSku(companyId)
  return resposta.send(resultado)
}

async function listarProdutos(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const { q, incluirInativos } = requisicao.query as { q?: string; incluirInativos?: string }
  const produtos = await servicoDeProdutos.listarProdutos(
    companyId,
    q,
    incluirInativos === 'true'
  )
  return resposta.send({ produtos })
}

async function buscarProduto(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const produto = await servicoDeProdutos.buscarProduto(id, companyId)
  return resposta.send({ produto })
}

async function criarProduto(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeProduto.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const produto = await servicoDeProdutos.criarProduto(
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ produto })
}

async function editarProduto(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeProduto.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const produto = await servicoDeProdutos.editarProduto(
    id,
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ produto })
}

async function alterarStatusDoProduto(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeAtivarProduto.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const produto = await servicoDeProdutos.alterarStatusDoProduto(
    id,
    resultado.data.ativo,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ produto })
}

async function salvarFotoDoProduto(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeUploadFotoProduto.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }

  const companyId = requisicao.empresaAtivaId || ''
  const produto = await servicoDeProdutos.salvarFotoDoProduto(
    id,
    resultado.data,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ produto })
}

async function removerFotoDoProduto(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const companyId = requisicao.empresaAtivaId || ''
  const produto = await servicoDeProdutos.removerFotoDoProduto(
    id,
    companyId,
    requisicao.idDoUsuario!
  )
  return resposta.send({ produto })
}

async function listarUnidadesMedida(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const unidades = await servicoDeUnidadesMedida.listarUnidades(companyId)
  return resposta.send({ unidades })
}

async function criarUnidadeMedida(requisicao: FastifyRequest, resposta: FastifyReply) {
  const companyId = requisicao.empresaAtivaId || ''
  const unidade = await servicoDeUnidadesMedida.criarUnidade(
    requisicao.body,
    companyId
  )
  return resposta.status(201).send({ unidade })
}

export const controladorDeProdutos = {
  listarProdutos,
  listarMarcas,
  sugerirProximoSku,
  buscarProduto,
  criarProduto,
  editarProduto,
  alterarStatusDoProduto,
  salvarFotoDoProduto,
  removerFotoDoProduto,
  listarUnidadesMedida,
  criarUnidadeMedida,
}
