/**
 * Controlador HTTP — Entrada de Notas (pipeline).
 */
import { readFile } from 'node:fs/promises'
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { servicoEntradaNotas } from './servico-pipeline-entrada.js'
import {
  esquemaContatoFornecedor,
  esquemaDefinirPedido,
  esquemaDefinirPrazo,
  esquemaDesvincularItem,
  esquemaDefinirCfopEntrada,
  esquemaDefinirCfopEntradaCte,
  esquemaGravarCodigoOriginal,
  esquemaImportarFiscal,
  esquemaFinanceiroFrete,
  esquemaLancar,
  esquemaLiberarCriticas,
  esquemaBaixarContagem,
  esquemaDesbloquearEstoque,
  esquemaManifestar,
  esquemaMarcarProblema,
  esquemaResolverDivergencia,
  esquemaResolverProblema,
  esquemaTratativa,
  esquemaVincularCte,
  esquemaVincularItem,
  esquemaVoltarEtapa,
  esquemaAnalisar,
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
  const parsed = esquemaAnalisar.safeParse(requisicao.body ?? {})
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.analisarNota(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    {
      forcarReparseItens: parsed.data.forcarReparseItens === true,
      pararEm: parsed.data.pararEm,
    }
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

async function definirCfopEntradaCte(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaDefinirCfopEntradaCte.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.definirCfopEntradaCte(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
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

async function marcarProblema(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaMarcarProblema.safeParse(requisicao.body ?? {})
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.marcarProblema(
    companyIdDe(requisicao),
    notaIdDe(requisicao)
  )
  return resposta.send(dados)
}

async function listarTratativas(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoEntradaNotas.listarTratativas(
    companyIdDe(requisicao),
    notaIdDe(requisicao)
  )
  return resposta.send(dados)
}

async function adicionarTratativa(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaTratativa.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.adicionarTratativa(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    usuarioIdDe(requisicao),
    parsed.data.texto
  )
  return resposta.send(dados)
}

async function resolverProblema(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaResolverProblema.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.resolverProblema(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data.desfecho
  )
  return resposta.send(dados)
}

async function descancelar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoEntradaNotas.descancelar(
    companyIdDe(requisicao),
    notaIdDe(requisicao)
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

async function aceitarAuditoriaChegada(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoEntradaNotas.aceitarAuditoriaChegada(
    companyIdDe(requisicao),
    notaIdDe(requisicao)
  )
  return resposta.send(dados)
}

async function liberarParaContagem(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoEntradaNotas.liberarParaContagem(
    companyIdDe(requisicao),
    notaIdDe(requisicao)
  )
  return resposta.send(dados)
}

async function baixarContagem(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaBaixarContagem.safeParse(requisicao.body ?? {})
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.baixarContagem(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    usuarioIdDe(requisicao),
    parsed.data.senha
  )
  return resposta.send(dados)
}

async function voltarParaContagem(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoEntradaNotas.voltarParaContagem(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    usuarioIdDe(requisicao)
  )
  return resposta.send(dados)
}

async function desbloquearEstoque(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaDesbloquearEstoque.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.desbloquearEstoqueDivergencia(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    usuarioIdDe(requisicao),
    parsed.data
  )
  return resposta.send(dados)
}

async function resolverDivergencia(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaResolverDivergencia.safeParse(requisicao.body)
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.resolverDivergenciaContagem(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    usuarioIdDe(requisicao),
    parsed.data
  )
  return resposta.send(dados)
}

async function baixarAnexoDivergencia(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { anexoId } = requisicao.params as { id: string; anexoId: string }
  const { caminhoAbsoluto, nomeArquivo, mimeType } =
    await servicoEntradaNotas.baixarAnexoDivergencia(
      companyIdDe(requisicao),
      notaIdDe(requisicao),
      anexoId
    )
  const buffer = await readFile(caminhoAbsoluto)
  const nomeSeguro = nomeArquivo.replace(/["\r\n]/g, '_')
  resposta.header(
    'Content-Disposition',
    `attachment; filename="${nomeSeguro}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`
  )
  return resposta.type(mimeType).send(buffer)
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

async function salvarFinanceiroFrete(requisicao: FastifyRequest, resposta: FastifyReply) {
  const parsed = esquemaFinanceiroFrete.safeParse(requisicao.body ?? {})
  if (!parsed.success) throw new ErroDaAplicacao(parsed.error.errors[0].message, 400)
  const dados = await servicoEntradaNotas.salvarFinanceiroFrete(
    companyIdDe(requisicao),
    notaIdDe(requisicao),
    parsed.data
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
  const companyId = companyIdDe(requisicao)
  // Abertura da lista / F5: cancela CT-e Focus com tomador ≠ empresa e remove
  // auto-vínculos indevidos antes de tentar novos vínculos — sem depender do BUSCAR.
  const ctesCanceladosTomador =
    await servicoEntradaNotas.repararCtesTomadorIndevido(companyId)
  const vinculosReparados =
    await servicoEntradaNotas.repararVinculosCteTomadorIndevido(companyId)
  const dados = await servicoEntradaNotas.processarVinculosCtePendentes(companyId, {
    // Default true: Focus só entra se o CT-e tiver chave de NF e ela não estiver no ERP
    importarFocusSeAusente: body.importarFocusSeAusente !== false,
    // true = BUSCAR / retry — reprocessa mesmo CT-e que já falhou Focus
    forcarRetryFocus: body.forcarRetryFocus === true,
  })
  return resposta.send({ ...dados, vinculosReparados, ctesCanceladosTomador })
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
  definirCfopEntradaCte,
  liberarCriticas,
  cancelarLiberacao,
  contato,
  definirPedido,
  definirPrazo,
  manifestar,
  marcarProblema,
  listarTratativas,
  adicionarTratativa,
  resolverProblema,
  descancelar,
  lancar,
  aceitarAuditoriaChegada,
  liberarParaContagem,
  baixarContagem,
  voltarParaContagem,
  desbloquearEstoque,
  resolverDivergencia,
  baixarAnexoDivergencia,
  vincularCte,
  desvincularCte,
  salvarFinanceiroFrete,
  vincularFornecedoresPendentes,
  vincularCtesPendentes,
  ctesAguardandoNf,
}
