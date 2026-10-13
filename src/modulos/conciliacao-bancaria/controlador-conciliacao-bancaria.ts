import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ZodSchema } from 'zod'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  esquemaConcluirConciliacao,
  esquemaConsultaConciliacao,
  esquemaConsultaMovimentos,
  esquemaCriarLancamentoConciliacao,
  esquemaUploadExtrato,
} from './esquema-conciliacao-bancaria.js'
import { servicoConciliacaoBancaria } from './servico-conciliacao-bancaria.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

function validar<T>(esquema: ZodSchema<T>, valor: unknown): T {
  const parse = esquema.safeParse(valor)
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados inválidos', 400)
  }
  return parse.data
}

async function consultar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const filtro = validar(esquemaConsultaConciliacao, requisicao.query)
  return resposta.send(await servicoConciliacaoBancaria.consultar(companyId(requisicao), filtro))
}

async function importar(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = validar(esquemaUploadExtrato, requisicao.body)
  const resultado = await servicoConciliacaoBancaria.importarExtrato(
    companyId(requisicao),
    requisicao.idDoUsuario!,
    dados
  )
  return resposta.code(201).send(resultado)
}

async function concluir(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = validar(esquemaConcluirConciliacao, requisicao.body)
  const resultado = await servicoConciliacaoBancaria.concluir(
    companyId(requisicao),
    requisicao.idDoUsuario!,
    dados
  )
  return resposta.code(201).send(resultado)
}

async function desvincular(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { id } = requisicao.params as { id: string }
  const resultado = await servicoConciliacaoBancaria.desvincular(
    companyId(requisicao),
    requisicao.idDoUsuario!,
    id
  )
  return resposta.send(resultado)
}

async function criarLancamento(requisicao: FastifyRequest, resposta: FastifyReply) {
  const dados = validar(esquemaCriarLancamentoConciliacao, requisicao.body)
  const resultado = await servicoConciliacaoBancaria.criarLancamento(
    companyId(requisicao),
    requisicao.idDoUsuario!,
    dados
  )
  return resposta.code(201).send(resultado)
}

async function listarExtratos(requisicao: FastifyRequest, resposta: FastifyReply) {
  return resposta.send({
    extratos: await servicoConciliacaoBancaria.listarExtratos(companyId(requisicao)),
  })
}

async function modeloCsv(_requisicao: FastifyRequest, resposta: FastifyReply) {
  return resposta
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', 'attachment; filename="modelo-extrato.csv"')
    .send(`\uFEFF${servicoConciliacaoBancaria.modeloCsv()}`)
}

async function listarMovimentacoes(requisicao: FastifyRequest, resposta: FastifyReply) {
  const filtro = validar(esquemaConsultaMovimentos, requisicao.query)
  return resposta.send({
    movimentacoes: await servicoConciliacaoBancaria.listarMovimentacoes(
      companyId(requisicao),
      filtro
    ),
  })
}

async function listarFluxo(requisicao: FastifyRequest, resposta: FastifyReply) {
  const filtro = validar(esquemaConsultaMovimentos, requisicao.query)
  return resposta.send({
    dias: await servicoConciliacaoBancaria.listarFluxo(companyId(requisicao), filtro),
  })
}

async function relatorio(requisicao: FastifyRequest, resposta: FastifyReply) {
  const filtro = validar(esquemaConsultaConciliacao, requisicao.query)
  return resposta.send({
    totais: await servicoConciliacaoBancaria.relatorio(companyId(requisicao), filtro),
  })
}

async function relatorioCsv(requisicao: FastifyRequest, resposta: FastifyReply) {
  const filtro = validar(esquemaConsultaConciliacao, requisicao.query)
  const totais = await servicoConciliacaoBancaria.relatorio(companyId(requisicao), filtro)
  const csv = [
    'Indicador;Valor;Quantidade',
    `Total do extrato;${totais.totalExtrato.toFixed(2)};${totais.quantidadeExtrato}`,
    `Conciliado;${totais.conciliado.toFixed(2)};${totais.quantidadeConciliada}`,
    `Pendente;${totais.pendente.toFixed(2)};${totais.quantidadePendente}`,
    `Não identificado;${totais.naoIdentificado.toFixed(2)};${totais.quantidadeNaoIdentificada}`,
  ].join('\r\n')
  return resposta
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', 'attachment; filename="relatorio-conciliacao.csv"')
    .send(`\uFEFF${csv}`)
}

export const controladorConciliacaoBancaria = {
  consultar,
  importar,
  concluir,
  desvincular,
  criarLancamento,
  listarExtratos,
  modeloCsv,
  listarMovimentacoes,
  listarFluxo,
  relatorio,
  relatorioCsv,
}
