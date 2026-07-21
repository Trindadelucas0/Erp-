/**
 * Controlador HTTP Focus NFe.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { logFocus } from './logs-focus-nfe.js'
import { servicoFocusNfe } from './servico-focus-nfe.js'
import {
  esquemaParaSalvarConfigFocus,
  esquemaImportarXml,
  esquemaRegrasFiscais,
} from './esquema-focus-nfe.js'

function companyIdDe(requisicao: FastifyRequest): string {
  const companyId = requisicao.empresaAtivaId || ''
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)
  return companyId
}

async function buscarConfig(requisicao: FastifyRequest, resposta: FastifyReply) {
  const config = await servicoFocusNfe.buscarConfig(companyIdDe(requisicao))
  return resposta.send({ config })
}

async function salvarConfig(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaParaSalvarConfigFocus.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }
  await servicoFocusNfe.salvarConfig(companyIdDe(requisicao), resultado.data)
  return resposta.send({ sucesso: true })
}

async function salvarRegrasFiscais(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaRegrasFiscais.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }
  const dados = await servicoFocusNfe.salvarRegrasFiscais(
    companyIdDe(requisicao),
    resultado.data
  )
  return resposta.send(dados)
}

async function testarConexao(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = await servicoFocusNfe.testarConexao(companyIdDe(requisicao))
  return resposta.send(resultado)
}

async function sincronizar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const body = (requisicao.body ?? {}) as { completo?: boolean }
  const job = await servicoFocusNfe.enfileirarSync(companyIdDe(requisicao), {
    completo: body.completo === true,
  })
  return resposta.status(202).send(job)
}

async function statusJob(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const job = await servicoFocusNfe.statusJob(companyIdDe(requisicao), id)
  return resposta.send({ job })
}

async function listarPendentes(requisicao: FastifyRequest, resposta: FastifyReply) {
  const q = requisicao.query as {
    dataDe?: string
    dataAte?: string
    painel?: string
    busca?: string
  }
  const painelRaw = (q.painel ?? 'analise').toLowerCase()
  const painelValidos = ['analise', 'contagem', 'consolidada', 'cancelada'] as const
  type Painel = (typeof painelValidos)[number]
  const painel: Painel = painelValidos.includes(painelRaw as Painel)
    ? (painelRaw as Painel)
    : 'analise'

  const notas = await servicoFocusNfe.listarPendentes(companyIdDe(requisicao), {
    dataDe: q.dataDe,
    dataAte: q.dataAte,
    painel,
    busca: q.busca,
  })
  return resposta.send({ notas, painel })
}

async function obterXml(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const q = requisicao.query as { modo?: string }
  const visualizar = (q.modo ?? '').toLowerCase() === 'visualizar'
  const dados = await servicoFocusNfe.obterXmlNota(companyIdDe(requisicao), id)

  if (visualizar) {
    return resposta.send({
      id: dados.id,
      chaveNfe: dados.chaveNfe,
      tipoDocumento: dados.tipoDocumento,
      nomeEmitente: dados.nomeEmitente,
      documentoEmitente: dados.documentoEmitente,
      valorTotal: dados.valorTotal,
      dataEmissao: dados.dataEmissao,
      origemXml: dados.origemXml,
      visualizacao: dados.visualizacao,
    })
  }

  const nomeArquivo = `${dados.chaveNfe || id}.xml`
  return resposta
    .header('Content-Type', 'application/xml; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${nomeArquivo}"`)
    .send(dados.xml)
}

async function obterDanfe(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const dados = await servicoFocusNfe.obterDanfeNota(companyIdDe(requisicao), id)
  const prefixo = dados.tipoDocumento === 'nfse' ? 'DANFSe' : 'DANFE'
  const nomeArquivo = `${prefixo}-${dados.chaveNfe || id}.pdf`
  return resposta
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${nomeArquivo}"`)
    .send(dados.pdf)
}

async function importarXml(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultado = esquemaImportarXml.safeParse(requisicao.body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(resultado.error.errors[0].message, 400)
  }
  try {
    const dados = await servicoFocusNfe.importarXml(
      companyIdDe(requisicao),
      resultado.data.xml
    )
    return resposta.status(201).send(dados)
  } catch (erro) {
    if (erro instanceof ErroDaAplicacao) {
      logFocus('warn', 'import_xml_recusado', {
        http: erro.codigoHttp,
        mensagem: erro.message,
      })
    }
    throw erro
  }
}

async function reprocessarXmls(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = await servicoFocusNfe.reprocessarXmlsLocais(companyIdDe(requisicao))
  return resposta.send(dados)
}

async function previewFiscal(requisicao: FastifyRequest, resposta: FastifyReply) {
  const analise = await servicoFocusNfe.previewAnaliseFiscal(companyIdDe(requisicao))
  return resposta.send({ analise })
}

export const controladorFocusNfe = {
  buscarConfig,
  salvarConfig,
  salvarRegrasFiscais,
  testarConexao,
  sincronizar,
  statusJob,
  listarPendentes,
  obterXml,
  obterDanfe,
  importarXml,
  reprocessarXmls,
  previewFiscal,
}
