import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeEnderecosWms } from './servico-enderecos-wms.js'
import {
  esquemaDeCriacaoDeEnderecoWms,
  esquemaDeEdicaoDeEnderecoWms,
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
    local: query.data.local || undefined,
    area: query.data.area || undefined,
    tipo: query.data.tipo || undefined,
    incluirInativos: query.data.incluirInativos === 'true',
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

export const controladorDeEnderecosWms = {
  listarEnderecos,
  buscarEndereco,
  criarEndereco,
  editarEndereco,
}
