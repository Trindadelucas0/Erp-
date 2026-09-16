import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoDeEstruturaWms } from './servico-estrutura-wms.js'
import {
  esquemaDeCriacaoDeNivelWms,
  esquemaDeEdicaoDeNivelWms,
  esquemaDeMoverNivelWms,
  esquemaFiltroListagemEstruturaWms,
  esquemaGerarEstruturaWms,
} from './esquema-estrutura-wms.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listarNiveis(requisicao: FastifyRequest, resposta: FastifyReply) {
  const query = esquemaFiltroListagemEstruturaWms.safeParse(requisicao.query)
  if (!query.success) {
    throw new ErroDaAplicacao(query.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const arvore = await servicoDeEstruturaWms.listar(companyId(requisicao), {
    q: query.data.q,
    status: query.data.status || undefined,
    incluirInativos: query.data.incluirInativos === 'true',
  })
  return resposta.send({ arvore, niveis: arvore })
}

async function buscarNivel(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const nivel = await servicoDeEstruturaWms.buscarPorId(companyId(requisicao), id)
  return resposta.send({ nivel })
}

async function criarNivel(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaDeCriacaoDeNivelWms.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const nivel = await servicoDeEstruturaWms.criarNivel(
    companyId(requisicao),
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ nivel })
}

async function editarNivel(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeEdicaoDeNivelWms.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const nivel = await servicoDeEstruturaWms.editarNivel(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ nivel })
}

async function excluirNivel(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  await servicoDeEstruturaWms.excluirNivel(companyId(requisicao), id, requisicao.idDoUsuario!)
  return resposta.send({ ok: true })
}

async function moverNivel(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = esquemaDeMoverNivelWms.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const nivel = await servicoDeEstruturaWms.moverNivel(
    companyId(requisicao),
    id,
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ nivel })
}

async function previewGerar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaGerarEstruturaWms.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const preview = await servicoDeEstruturaWms.previewGerar(companyId(requisicao), resultado.data)
  return resposta.send(preview)
}

async function gerar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaGerarEstruturaWms.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const gerado = await servicoDeEstruturaWms.gerarEstrutura(
    companyId(requisicao),
    resultado.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send(gerado)
}

export const controladorDeEstruturaWms = {
  listarNiveis,
  buscarNivel,
  criarNivel,
  editarNivel,
  excluirNivel,
  moverNivel,
  previewGerar,
  gerar,
}
