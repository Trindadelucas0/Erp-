import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { middlewareDeAutenticacao } from '../../infraestrutura/autenticacao/middleware-de-autenticacao.js'
import { middlewareDeAutorizacao } from '../../infraestrutura/autenticacao/middleware-de-autorizacao.js'
import { middlewareEmpresaAtiva } from '../../infraestrutura/autenticacao/middleware-empresa-ativa.js'
import { esquemaOrcamento } from './esquema-orcamentos.js'
import { servicoDeOrcamentos } from './servico-orcamentos.js'

function companyIdDaSessao(requisicao: FastifyRequest): string {
  const companyId = requisicao.empresaAtivaId
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa obrigatória', 400)
  return companyId
}

function idDaUrl(requisicao: FastifyRequest): string {
  const { id } = requisicao.params as { id?: string }
  if (!id || !z.string().uuid().safeParse(id).success) {
    throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  }
  return id
}

function lerCorpo(requisicao: FastifyRequest) {
  const resultado = esquemaOrcamento.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  return resultado.data
}

async function listar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const orcamentos = await servicoDeOrcamentos.listar(companyIdDaSessao(requisicao))
  return resposta.send({ orcamentos })
}

async function proximoNumero(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoDeOrcamentos.preenchimentoNovo(companyIdDaSessao(requisicao))
  return resposta.send(dados)
}

async function obter(requisicao: FastifyRequest, resposta: FastifyReply) {
  const orcamento = await servicoDeOrcamentos.obter(companyIdDaSessao(requisicao), idDaUrl(requisicao))
  return resposta.send({ orcamento })
}

async function criar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const orcamento = await servicoDeOrcamentos.criar(
    companyIdDaSessao(requisicao),
    lerCorpo(requisicao),
    requisicao.idDoUsuario
  )
  return resposta.status(201).send({ orcamento })
}

async function atualizar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const orcamento = await servicoDeOrcamentos.atualizar(
    companyIdDaSessao(requisicao),
    idDaUrl(requisicao),
    lerCorpo(requisicao),
    requisicao.idDoUsuario
  )
  return resposta.send({ orcamento })
}

async function finalizar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const orcamento = await servicoDeOrcamentos.finalizar(
    companyIdDaSessao(requisicao),
    idDaUrl(requisicao),
    requisicao.idDoUsuario
  )
  return resposta.send({ orcamento })
}

const esquemaDesconto = z.object({
  percentual: z.coerce.number().min(0).max(100),
  itemIds: z.array(z.string().uuid()).nullable(),
})

async function aplicarDesconto(requisicao: FastifyRequest, resposta: FastifyReply) {
  const corpo = esquemaDesconto.safeParse(requisicao.body)
  if (!corpo.success) {
    throw new ErroDaAplicacao(corpo.error.errors[0]?.message ?? 'Desconto inválido', 400)
  }
  const orcamento = await servicoDeOrcamentos.aplicarDesconto(
    companyIdDaSessao(requisicao),
    idDaUrl(requisicao),
    corpo.data.percentual,
    corpo.data.itemIds,
    requisicao.idDoUsuario
  )
  return resposta.send({ orcamento })
}

const esquemaCopiarPedido = z.object({ pedidoVendaId: z.string().uuid() })
const esquemaAnexo = z.object({
  nomeArquivo: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  base64Arquivo: z.string().min(1),
})

async function copiarPedido(requisicao: FastifyRequest, resposta: FastifyReply) {
  const corpo = esquemaCopiarPedido.safeParse(requisicao.body)
  if (!corpo.success) throw new ErroDaAplicacao('Pedido de venda inválido', 400)
  const orcamento = await servicoDeOrcamentos.copiarPedido(
    companyIdDaSessao(requisicao),
    idDaUrl(requisicao),
    corpo.data.pedidoVendaId,
    requisicao.idDoUsuario
  )
  return resposta.send({ orcamento })
}

async function listarAnexos(requisicao: FastifyRequest, resposta: FastifyReply) {
  return resposta.send({
    anexos: await servicoDeOrcamentos.listarAnexos(
      companyIdDaSessao(requisicao),
      idDaUrl(requisicao)
    ),
  })
}

async function enviarAnexo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const corpo = esquemaAnexo.safeParse(requisicao.body)
  if (!corpo.success) throw new ErroDaAplicacao('Dados do anexo inválidos', 400)
  const anexo = await servicoDeOrcamentos.enviarAnexo(
    companyIdDaSessao(requisicao),
    idDaUrl(requisicao),
    requisicao.idDoUsuario!,
    corpo.data
  )
  return resposta.status(201).send({ anexo })
}

async function baixarAnexo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { anexoId } = requisicao.params as { anexoId: string }
  const anexo = await servicoDeOrcamentos.baixarAnexo(
    companyIdDaSessao(requisicao),
    idDaUrl(requisicao),
    anexoId
  )
  resposta.header('Content-Disposition', `attachment; filename="${anexo.nomeArquivo.replace(/["\r\n]/g, '_')}"`)
  return resposta.type(anexo.mimeType).send(await readFile(anexo.caminhoAbsoluto))
}

async function excluirAnexo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { anexoId } = requisicao.params as { anexoId: string }
  return resposta.send(
    await servicoDeOrcamentos.excluirAnexo(
      companyIdDaSessao(requisicao),
      idDaUrl(requisicao),
      anexoId
    )
  )
}

async function enviarEmail(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = await servicoDeOrcamentos.enviarEmail(
    companyIdDaSessao(requisicao),
    idDaUrl(requisicao)
  )
  return resposta.send(resultado)
}

export async function rotasDeOrcamentos(aplicacao: FastifyInstance): Promise<void> {
  const auth = [middlewareDeAutenticacao, middlewareEmpresaAtiva]

  aplicacao.get('/', { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] }, listar)
  aplicacao.get(
    '/proximo-numero',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] },
    proximoNumero
  )
  aplicacao.get('/:id', { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] }, obter)
  aplicacao.post('/', { preHandler: [...auth, middlewareDeAutorizacao('vendas:create')] }, criar)
  aplicacao.patch('/:id', { preHandler: [...auth, middlewareDeAutorizacao('vendas:edit')] }, atualizar)
  aplicacao.post(
    '/:id/finalizar',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:approve')] },
    finalizar
  )
  aplicacao.post(
    '/:id/desconto',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:approve')] },
    aplicarDesconto
  )
  aplicacao.post(
    '/:id/copiar-pedido',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:edit')] },
    copiarPedido
  )
  aplicacao.get(
    '/:id/anexos',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] },
    listarAnexos
  )
  aplicacao.post(
    '/:id/anexos',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:edit')] },
    enviarAnexo
  )
  aplicacao.get(
    '/:id/anexos/:anexoId/download',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:view')] },
    baixarAnexo
  )
  aplicacao.delete(
    '/:id/anexos/:anexoId',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:edit')] },
    excluirAnexo
  )
  aplicacao.post(
    '/:id/enviar-email',
    { preHandler: [...auth, middlewareDeAutorizacao('vendas:edit')] },
    enviarEmail
  )
}
