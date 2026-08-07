/**
 * Controlador HTTP — Contagens de entrada cega.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  esquemaAtualizarQtdContada,
  esquemaBipContagem,
  esquemaCriarContagem,
  esquemaGravarContagem,
} from './esquema-contagens.js'
import { servicoContagens } from './servico-contagens.js'

function companyIdDe(requisicao: FastifyRequest): string {
  const companyId = requisicao.empresaAtivaId || ''
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)
  return companyId
}

function usuarioIdDe(requisicao: FastifyRequest): string {
  const id = requisicao.idDoUsuario || ''
  if (!id) throw new ErroDaAplicacao('Usuário não autenticado', 401)
  return id
}

async function listarDisponiveis(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoContagens.listarDisponiveis(companyIdDe(requisicao))
  return resposta.send(dados)
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaCriarContagem.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoContagens.criar(
    companyIdDe(requisicao),
    usuarioIdDe(requisicao),
    parsed.data.nfeRecebidaIds
  )
  return resposta.status(201).send(dados)
}

async function detalhe(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const dados = await servicoContagens.obterDetalhe(companyIdDe(requisicao), id)
  return resposta.send(dados)
}

async function bipar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const parsed = esquemaBipContagem.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoContagens.bipar(
    companyIdDe(requisicao),
    id,
    parsed.data.codigoBarras
  )
  return resposta.send(dados)
}

async function atualizarItem(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id, itemId } = requisicao.params as { id: string; itemId: string }
  const parsed = esquemaAtualizarQtdContada.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoContagens.atualizarQtdManual(
    companyIdDe(requisicao),
    id,
    itemId,
    parsed.data.qtdContada
  )
  return resposta.send(dados)
}

async function gravar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const parsed = esquemaGravarContagem.safeParse(requisicao.body ?? {})
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoContagens.gravar(companyIdDe(requisicao), id, {
    confirmarDivergencia: parsed.data.confirmarDivergencia,
    observacao: parsed.data.observacao,
  })
  return resposta.send(dados)
}

async function cancelar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const dados = await servicoContagens.cancelar(companyIdDe(requisicao), id)
  return resposta.send(dados)
}

export const controladorContagens = {
  listarDisponiveis,
  criar,
  detalhe,
  bipar,
  atualizarItem,
  gravar,
  cancelar,
}
