import { readFile } from 'node:fs/promises'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  esquemaBaixaLote,
  esquemaDeCriacaoDeContaReceber,
  esquemaDeEdicaoDeContaReceber,
  esquemaFiltroHistoricoBaixas,
  esquemaFiltroListagemContasReceber,
  esquemaUploadAnexoContaReceber,
} from './esquema-contas-a-receber.js'
import { servicoDeContasAReceber } from './servico-contas-a-receber.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroListagemContasReceber.safeParse(requisicao.query ?? {})
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const contas = await servicoDeContasAReceber.listar(companyId(requisicao), parse.data)
  return resposta.send({ contas })
}

async function listarParaBaixar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroListagemContasReceber.safeParse(requisicao.query ?? {})
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const contas = await servicoDeContasAReceber.listarParaBaixar(companyId(requisicao), parse.data)
  return resposta.send({ contas })
}

async function listarHistoricoBaixas(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaFiltroHistoricoBaixas.safeParse(requisicao.query ?? {})
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Filtro inválido', 400)
  }
  const baixas = await servicoDeContasAReceber.listarHistoricoBaixas(
    companyId(requisicao),
    parse.data
  )
  return resposta.send({ baixas })
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const conta = await servicoDeContasAReceber.obter(companyId(requisicao), id)
  return resposta.send({ conta })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaDeCriacaoDeContaReceber.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const conta = await servicoDeContasAReceber.criar(
    companyId(requisicao),
    parse.data,
    requisicao.idDoUsuario!
  )
  return resposta.status(201).send({ conta })
}

async function editar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const parse = esquemaDeEdicaoDeContaReceber.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  const conta = await servicoDeContasAReceber.editar(
    companyId(requisicao),
    id,
    parse.data,
    requisicao.idDoUsuario!
  )
  return resposta.send({ conta })
}

async function excluir(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = await servicoDeContasAReceber.excluir(
    companyId(requisicao),
    id,
    requisicao.idDoUsuario!
  )
  return resposta.send(resultado)
}

async function baixar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parse = esquemaBaixaLote.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados de baixa inválidos', 400)
  }
  const resultado = await servicoDeContasAReceber.baixar(
    companyId(requisicao),
    requisicao.idDoUsuario!,
    parse.data
  )
  return resposta.status(201).send(resultado)
}

async function listarAnexos(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const anexos = await servicoDeContasAReceber.listarAnexos(companyId(requisicao), id)
  return resposta.send({ anexos })
}

async function enviarAnexo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const parse = esquemaUploadAnexoContaReceber.safeParse(requisicao.body)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados do anexo inválidos', 400)
  }
  const anexo = await servicoDeContasAReceber.enviarAnexo(
    companyId(requisicao),
    id,
    requisicao.idDoUsuario!,
    parse.data
  )
  return resposta.status(201).send({ anexo })
}

async function baixarAnexo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id, anexoId } = requisicao.params as { id: string; anexoId: string }
  const { caminhoAbsoluto, nomeArquivo, mimeType } =
    await servicoDeContasAReceber.baixarAnexoArquivo(companyId(requisicao), id, anexoId)
  const buffer = await readFile(caminhoAbsoluto)
  const nomeSeguro = nomeArquivo.replace(/["\r\n]/g, '_')
  resposta.header(
    'Content-Disposition',
    `attachment; filename="${nomeSeguro}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`
  )
  return resposta.type(mimeType).send(buffer)
}

async function excluirAnexo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id, anexoId } = requisicao.params as { id: string; anexoId: string }
  const resultado = await servicoDeContasAReceber.excluirAnexo(
    companyId(requisicao),
    id,
    anexoId,
    requisicao.idDoUsuario!
  )
  return resposta.send(resultado)
}

export const controladorDeContasAReceber = {
  listar,
  listarParaBaixar,
  listarHistoricoBaixas,
  obter,
  criar,
  editar,
  excluir,
  baixar,
  listarAnexos,
  enviarAnexo,
  baixarAnexo,
  excluirAnexo,
}
