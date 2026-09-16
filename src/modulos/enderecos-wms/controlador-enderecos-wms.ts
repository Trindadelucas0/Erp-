import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeEnderecosWms } from './servico-enderecos-wms.js'
import {
  esquemaDeCriacaoDeEnderecoWms,
  esquemaDeEdicaoDeEnderecoWms,
  esquemaDeMoverEnderecoWms,
  esquemaFiltroListagemEnderecoWms,
} from './esquema-enderecos-wms.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listarEnderecos(requisicao: FastifyRequest, resposta: FastifyReply) {
  const query = esquemaFiltroListagemEnderecoWms.safeParse(requisicao.query)
  if (!query.success) {
    throw new ErroDaAplicacao(query.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const enderecos = await servicoDeEnderecosWms.listar(companyId(requisicao), {
    q: query.data.q,
    andarId: query.data.andarId,
    incluirInativos: query.data.incluirInativos === 'true',
    status: query.data.status || undefined,
    take: query.data.take,
  })
  return resposta.send({ enderecos })
}

async function buscarEndereco(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const endereco = await servicoDeEnderecosWms.buscarPorId(companyId(requisicao), id)
  return resposta.send({ endereco })
}

async function criarEndereco(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeEnderecoWms.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const endereco = await servicoDeEnderecosWms.criarEndereco(
    companyId(requisicao),
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ endereco })
}

async function editarEndereco(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeEnderecoWms.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const endereco = await servicoDeEnderecosWms.editarEndereco(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ endereco })
}

async function moverEndereco(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeMoverEnderecoWms.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const endereco = await servicoDeEnderecosWms.moverEndereco(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ endereco })
}

async function excluirEndereco(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  await servicoDeEnderecosWms.excluirEndereco(companyId(requisicao), id, requisicao.idDoUsuario!)
  return resposta.send({ ok: true })
}

export const controladorDeEnderecosWms = {
  listarEnderecos,
  buscarEndereco,
  criarEndereco,
  editarEndereco,
  moverEndereco,
  excluirEndereco,
}
