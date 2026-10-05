import type { ConfiguracaoBoleto } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import type { DadosGravarParametrosBoleto } from './esquema-parametros-boleto.js'
import {
  removerCertificadoBoleto,
  salvarCertificadoBoleto,
} from './armazenamento-certificado-boleto.js'
import { repositorioParametrosBoleto } from './repositorio-parametros-boleto.js'

const MSG_TESTE_OK = 'Dados de conexão preenchidos.'

function mascararSegredo(segredo: string): string {
  if (segredo.length <= 8) return '****'
  return `${segredo.slice(0, 4)}${'*'.repeat(Math.min(segredo.length - 8, 12))}${segredo.slice(-4)}`
}

function decimalParaNumero(valor: Decimal | null | undefined): number | null {
  if (valor == null) return null
  return Number(valor)
}

export type ParametroBoletoListaItem = {
  id: string
  nome: string
  banco: string | null
  ambiente: string | null
  padrao: boolean
  ativo: boolean
  ultimoTesteEm: string | null
  ultimoTesteSucesso: boolean | null
}

export type ParametroBoletoDetalhe = {
  id: string
  nome: string
  ativo: boolean
  padrao: boolean
  valorMinimo: number | null
  valorMaximo: number | null
  prazoMedioMaximoDias: number | null
  permitirParcelamento: boolean
  quantidadeMaximaParcelas: number | null
  multaAtrasoPercentual: number | null
  jurosAtrasoPercentualDia: number | null
  permitirPagamentoAposVencimento: boolean
  diasMaximosAposVencimento: number | null
  negativarAutomaticamente: boolean
  diasParaNegativar: number | null
  banco: string | null
  ambiente: string | null
  tipoIntegracao: string | null
  urlApi: string | null
  clientId: string | null
  clientSecretMascarado: string | null
  clientSecretDefinido: boolean
  certificadoNome: string | null
  ultimoTesteEm: string | null
  ultimoTesteSucesso: boolean | null
  ultimoTesteMensagem: string | null
}

function mapearListaItem(row: ConfiguracaoBoleto): ParametroBoletoListaItem {
  return {
    id: row.id,
    nome: row.nome,
    banco: row.banco,
    ambiente: row.ambiente,
    padrao: row.padrao,
    ativo: row.ativo,
    ultimoTesteEm: row.ultimoTesteEm?.toISOString() ?? null,
    ultimoTesteSucesso: row.ultimoTesteSucesso,
  }
}

function mapearDetalhe(row: ConfiguracaoBoleto): ParametroBoletoDetalhe {
  const segredo = row.clientSecret?.trim() ?? ''
  return {
    id: row.id,
    nome: row.nome,
    ativo: row.ativo,
    padrao: row.padrao,
    valorMinimo: decimalParaNumero(row.valorMinimo),
    valorMaximo: decimalParaNumero(row.valorMaximo),
    prazoMedioMaximoDias: row.prazoMedioMaximoDias,
    permitirParcelamento: row.permitirParcelamento,
    quantidadeMaximaParcelas: row.quantidadeMaximaParcelas,
    multaAtrasoPercentual: decimalParaNumero(row.multaAtrasoPercentual),
    jurosAtrasoPercentualDia: decimalParaNumero(row.jurosAtrasoPercentualDia),
    permitirPagamentoAposVencimento: row.permitirPagamentoAposVencimento,
    diasMaximosAposVencimento: row.diasMaximosAposVencimento,
    negativarAutomaticamente: row.negativarAutomaticamente,
    diasParaNegativar: row.diasParaNegativar,
    banco: row.banco,
    ambiente: row.ambiente,
    tipoIntegracao: row.tipoIntegracao ?? 'api',
    urlApi: row.urlApi,
    clientId: row.clientId,
    clientSecretMascarado: segredo ? mascararSegredo(segredo) : null,
    clientSecretDefinido: segredo.length > 0,
    certificadoNome: row.certificadoNome,
    ultimoTesteEm: row.ultimoTesteEm?.toISOString() ?? null,
    ultimoTesteSucesso: row.ultimoTesteSucesso,
    ultimoTesteMensagem: row.ultimoTesteMensagem,
  }
}

async function garantirNomeUnico(companyId: string, nome: string, excluirId?: string) {
  const duplicado = await repositorioParametrosBoleto.buscarPorNome(companyId, nome, excluirId)
  if (duplicado) {
    throw new ErroDaAplicacao('Já existe um parâmetro de boleto com este nome nesta empresa', 400)
  }
}

function montarCamposPrisma(
  dados: DadosGravarParametrosBoleto,
  clientSecret: string | null,
  certificado: {
    certificadoNome: string | null
    certificadoCaminho: string | null
    certificadoMime: string | null
  }
) {
  return {
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    padrao: dados.padrao ?? false,
    valorMinimo: dados.valorMinimo != null ? new Decimal(dados.valorMinimo) : null,
    valorMaximo: dados.valorMaximo != null ? new Decimal(dados.valorMaximo) : null,
    prazoMedioMaximoDias: dados.prazoMedioMaximoDias,
    permitirParcelamento: dados.permitirParcelamento,
    quantidadeMaximaParcelas: dados.quantidadeMaximaParcelas,
    multaAtrasoPercentual:
      dados.multaAtrasoPercentual != null ? new Decimal(dados.multaAtrasoPercentual) : null,
    jurosAtrasoPercentualDia:
      dados.jurosAtrasoPercentualDia != null
        ? new Decimal(dados.jurosAtrasoPercentualDia)
        : null,
    permitirPagamentoAposVencimento: dados.permitirPagamentoAposVencimento,
    diasMaximosAposVencimento: dados.diasMaximosAposVencimento,
    negativarAutomaticamente: dados.negativarAutomaticamente,
    diasParaNegativar: dados.diasParaNegativar,
    banco: dados.banco,
    ambiente: dados.ambiente,
    tipoIntegracao: dados.tipoIntegracao,
    urlApi: dados.urlApi,
    clientId: dados.clientId,
    clientSecret,
    certificadoNome: certificado.certificadoNome,
    certificadoCaminho: certificado.certificadoCaminho,
    certificadoMime: certificado.certificadoMime,
  }
}

async function aplicarCertificado(
  companyId: string,
  parametroId: string,
  dados: DadosGravarParametrosBoleto,
  existente: ConfiguracaoBoleto | null
) {
  let certificadoNome = existente?.certificadoNome ?? null
  let certificadoCaminho = existente?.certificadoCaminho ?? null
  let certificadoMime = existente?.certificadoMime ?? null

  if (dados.removerCertificado) {
    await removerCertificadoBoleto(certificadoCaminho)
    certificadoNome = null
    certificadoCaminho = null
    certificadoMime = null
  }

  if (dados.certificadoBase64?.trim()) {
    if (!dados.certificadoMime) {
      throw new ErroDaAplicacao('Informe o tipo do certificado', 400)
    }
    await removerCertificadoBoleto(certificadoCaminho)
    const salvo = await salvarCertificadoBoleto(
      companyId,
      parametroId,
      dados.certificadoMime,
      dados.certificadoBase64,
      dados.certificadoNomeArquivo
    )
    certificadoNome = salvo.nomeExibicao
    certificadoCaminho = salvo.caminhoArquivo
    certificadoMime = dados.certificadoMime
  }

  return { certificadoNome, certificadoCaminho, certificadoMime }
}

async function listar(
  companyId: string,
  filtro: { q?: string; incluirInativos?: boolean; somenteAtivos?: boolean }
) {
  const rows = await repositorioParametrosBoleto.listar(companyId, filtro)
  return rows.map(mapearListaItem)
}

async function obter(companyId: string, id: string) {
  const row = await repositorioParametrosBoleto.buscarPorId(companyId, id)
  if (!row) throw new ErroDaAplicacao('Parâmetro de boleto não encontrado', 404)
  return mapearDetalhe(row)
}

async function criar(companyId: string, dados: DadosGravarParametrosBoleto) {
  await garantirNomeUnico(companyId, dados.nome)

  if (dados.padrao) {
    await repositorioParametrosBoleto.limparPadraoEmpresa(companyId)
  }

  const row = await repositorioParametrosBoleto.criar({
    companyId,
    ...montarCamposPrisma(dados, dados.clientSecret ?? null, {
      certificadoNome: null,
      certificadoCaminho: null,
      certificadoMime: null,
    }),
  })

  const certificado = await aplicarCertificado(companyId, row.id, dados, row)
  if (
    certificado.certificadoCaminho !== row.certificadoCaminho ||
    certificado.certificadoNome !== row.certificadoNome
  ) {
    await repositorioParametrosBoleto.atualizar(companyId, row.id, certificado)
  }

  const atualizado = await repositorioParametrosBoleto.obterAtualizado(companyId, row.id)
  if (!atualizado) throw new ErroDaAplicacao('Parâmetro de boleto não encontrado', 404)

  return mapearDetalhe(atualizado)
}

async function editar(companyId: string, id: string, dados: DadosGravarParametrosBoleto) {
  const existente = await repositorioParametrosBoleto.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Parâmetro de boleto não encontrado', 404)

  await garantirNomeUnico(companyId, dados.nome, id)

  let clientSecret = existente.clientSecret
  if (dados.clientSecret) {
    clientSecret = dados.clientSecret
  }

  const certificado = await aplicarCertificado(companyId, id, dados, existente)

  if (dados.padrao && !existente.padrao) {
    await repositorioParametrosBoleto.limparPadraoEmpresa(companyId, id)
  }

  const resultado = await repositorioParametrosBoleto.atualizar(
    companyId,
    id,
    montarCamposPrisma(dados, clientSecret, certificado)
  )
  if (resultado.count === 0) throw new ErroDaAplicacao('Parâmetro de boleto não encontrado', 404)

  const atualizado = await repositorioParametrosBoleto.obterAtualizado(companyId, id)
  if (!atualizado) throw new ErroDaAplicacao('Parâmetro de boleto não encontrado', 404)

  return mapearDetalhe(atualizado)
}

async function alterarAtivo(companyId: string, id: string, ativo: boolean) {
  const existente = await repositorioParametrosBoleto.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Parâmetro de boleto não encontrado', 404)

  await repositorioParametrosBoleto.atualizar(companyId, id, { ativo })
  const atualizado = await repositorioParametrosBoleto.obterAtualizado(companyId, id)
  if (!atualizado) throw new ErroDaAplicacao('Parâmetro de boleto não encontrado', 404)
  return mapearListaItem(atualizado)
}

async function marcarPadrao(companyId: string, id: string) {
  const existente = await repositorioParametrosBoleto.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Parâmetro de boleto não encontrado', 404)

  const row = await repositorioParametrosBoleto.definirPadrao(companyId, id)
  if (!row) throw new ErroDaAplicacao('Parâmetro de boleto não encontrado', 404)
  return mapearListaItem(row)
}

async function testarConexao(companyId: string, id: string) {
  const row = await repositorioParametrosBoleto.buscarPorId(companyId, id)
  if (!row) {
    throw new ErroDaAplicacao('Salve os parâmetros antes de testar a conexão.', 400)
  }

  const clientId = row.clientId?.trim() ?? ''
  const segredo = row.clientSecret?.trim() ?? ''
  const url = row.urlApi?.trim() ?? ''

  if (!clientId || !segredo || !url.startsWith('https://')) {
    throw new ErroDaAplicacao(
      'Preencha Client ID, Client Secret e URL da API (https) antes de testar.',
      400
    )
  }

  await repositorioParametrosBoleto.atualizarTesteConexao(companyId, id, true, MSG_TESTE_OK)

  return {
    sucesso: true,
    mensagem: MSG_TESTE_OK,
    ultimoTesteEm: new Date().toISOString(),
  }
}

export const servicoParametrosBoleto = {
  listar,
  obter,
  criar,
  editar,
  alterarAtivo,
  marcarPadrao,
  testarConexao,
}
