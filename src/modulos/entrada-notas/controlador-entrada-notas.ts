/**
 * Controlador HTTP — Entrada de Notas (pipeline).
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoEntradaNotas } from './servico-pipeline-entrada.js'
import {
  esquemaContatoFornecedor,
  esquemaDefinirPedido,
  esquemaDefinirPrazo,
  esquemaDesvincularItem,
  esquemaDefinirCfopEntrada,
  esquemaGravarCodigoOriginal,
  esquemaImportarFiscal,
  esquemaLancar,
  esquemaLiberarCriticas,
  esquemaManifestar,
  esquemaVincularCte,
  esquemaVincularItem,
  esquemaVoltarEtapa,
} from './esquema-entrada-notas.js'

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

function notaIdDe(requisicao: FastifyRequest): string {
  const { id } = requisicao.params as { id: string }
  return id
}

async function detalhe(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoEntradaNotas.obterDetalhe(companyIdDe(requisicao), notaIdDe(requisicao))
  return resposta.send(dados)
}

async function analisar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const body = (requisicao.body ?? {}) as { forcarReparseItens?: boolean }
  const dados = await servicoEntradaNotas.analisarNota(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    { forcarReparseItens: body.forcarReparseItens === true }
  )
  return resposta.send(dados)
}

async function vincularItem(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaVincularItem.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.vincularItem(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data.itemId,
    parsed.data.produtoId
  )
  return resposta.send(dados)
}

async function desvincularItem(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaDesvincularItem.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.desvincularItem(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data.itemId
  )
  return resposta.send(dados)
}

async function voltarEtapa(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaVoltarEtapa.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.voltarEtapa(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    usuarioIdDe(requisicao),
    parsed.data.etapaDestino
  )
  return resposta.send(dados)
}

async function gravarCodigoOriginal(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaGravarCodigoOriginal.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.gravarCodigoOriginal(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data.itemId
  )
  return resposta.send(dados)
}

async function importarFiscal(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaImportarFiscal.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.importarFiscalProduto(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data.itemId,
    { ncm: parsed.data.ncm === true, origem: parsed.data.origem === true }
  )
  return resposta.send(dados)
}

async function definirCfopEntrada(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaDefinirCfopEntrada.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.definirCfopEntrada(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data.itemId,
    parsed.data.cfopId
  )
  return resposta.send(dados)
}

async function liberarCriticas(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaLiberarCriticas.safeParse(requisicao.body ?? {})
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.liberarCriticas(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    usuarioIdDe(requisicao),
    parsed.data.senha
  )
  return resposta.send(dados)
}

async function cancelarLiberacao(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoEntradaNotas.cancelarLiberacaoCriticas(
    companyIdDe(requisicao),
    notaIdDe(requisicao)
  )
  return resposta.send(dados)
}

async function contato(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaContatoFornecedor.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.contatoFornecedor(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data.observacao
  )
  return resposta.send(dados)
}

async function definirPedido(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaDefinirPedido.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.definirPedido(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data.pedidoCompraId
  )
  return resposta.send(dados)
}

async function definirPrazo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaDefinirPrazo.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.definirPrazo(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data.prazo
  )
  return resposta.send(dados)
}

async function manifestar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaManifestar.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.manifestar(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data.tipo,
    parsed.data.justificativa
  )
  return resposta.send(dados)
}

async function lancar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaLancar.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.lancar(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    usuarioIdDe(requisicao),
    parsed.data.modo,
    parsed.data.senha
  )
  return resposta.send(dados)
}

async function vincularCte(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaVincularCte.safeParse(requisicao.body ?? {})
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.vincularCte(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data
  )
  return resposta.send(dados)
}

async function desvincularCte(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { vinculoId } = requisicao.params as { id: string; vinculoId: string }
  const dados = await servicoEntradaNotas.desvincularCte(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    vinculoId
  )
  return resposta.send(dados)
}

async function vincularFornecedoresPendentes(requisicao: FastifyRequest, resposta: FastifyReply) {
  const vinculadas = await servicoEntradaNotas.vincularFornecedoresNasNotasPendentes(
    companyIdDe(requisicao)
  )
  return resposta.send({ vinculadas })
}

async function vincularCtesPendentes(requisicao: FastifyRequest, resposta: FastifyReply) {
  const body = (requisicao.body ?? {}) as {
    importarFocusSeAusente?: boolean
    forcarRetryFocus?: boolean
  }
  const dados = await servicoEntradaNotas.processarVinculosCtePendentes(
    companyIdDe(requisicao),
    {
      // Default true: Focus só entra se o CT-e tiver chave de NF e ela não estiver no ERP
      importarFocusSeAusente: body.importarFocusSeAusente !== false,
      // true = BUSCAR / retry — reprocessa mesmo CT-e que já falhou Focus
      forcarRetryFocus: body.forcarRetryFocus === true,
    }
  )
  return resposta.send(dados)
}

async function ctesAguardandoNf(requisicao: FastifyRequest, resposta: FastifyReply) {
  const itens = await servicoEntradaNotas.listarCtesAguardandoNf(companyIdDe(requisicao))
  return resposta.send({ itens, total: itens.length })
}

export const controladorEntradaNotas = {
  detalhe,
  analisar,
  vincularItem,
  desvincularItem,
  voltarEtapa,
  gravarCodigoOriginal,
  importarFiscal,
  definirCfopEntrada,
  liberarCriticas,
  cancelarLiberacao,
  contato,
  definirPedido,
  definirPrazo,
  manifestar,
  lancar,
  vincularCte,
  desvincularCte,
  vincularFornecedoresPendentes,
  vincularCtesPendentes,
  ctesAguardandoNf,
}
