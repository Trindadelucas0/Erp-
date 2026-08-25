/**
 * Orquestra o pipeline frete → cadastro → fiscal → negociação → lançamento automático (NFe 55).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { decodificarTextoXml } from '../../compartilhado/normalizacao/entidades-xml.js'
import { normalizarDocumento } from '../../compartilhado/validacoes/documentos.js'
import { servicoDeAutenticacao } from '../autenticacao/servico-autenticacao.js'
import { repositorioFocusNfe } from '../focus-nfe/repositorio-focus-nfe.js'
import { clienteFocusNfe } from '../focus-nfe/cliente-focus-nfe.js'
import {
  extrairCamposResumoDoXml,
  extrairCfopDoXmlCte,
  extrairDadosTransporteDoXmlNfe,
  extrairIcmsDoXmlCte,
  extrairItensDoJsonFocusCompleta,
  extrairItensDoXml,
  extrairSugestaoFinanceiroDoXmlCte,
  normalizarXmlNfe,
  xmlNfeTemItensParseaveis,
  type ItemXmlNfe,
} from '../focus-nfe/parser-xml-nfe.js'
import { logFocus } from '../focus-nfe/logs-focus-nfe.js'
import { analisarCadastro } from './analise-cadastro/analisar-cadastro.js'
import { analisarFiscalItens } from './analise-fiscal/analisar-fiscal-itens.js'
import { analisarNegociacao } from './analise-negociacao/analisar-negociacao.js'
import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import type { AnaliseJson, ResultadoEtapa } from './tipos-analise.js'
import { etapaVazia } from './tipos-analise.js'
import {
  avaliarAuditoriaChegada,
  lerChegadaDeAnalise,
  pendenteLiberacaoChegada,
  type AuditoriaChegadaJson,
} from './auditoria-chegada/avaliar-auditoria-chegada.js'
import type { RegrasFiscaisJson } from './analise-fiscal/analisar-fiscal-basico.js'
import { cfopEhConhecimentoFrete } from '../cfops/classificacao-cfop.js'
import {
  sanitizarRegrasFiscais,
  type DadosRegrasFiscais,
} from '../focus-nfe/esquema-focus-nfe.js'
import type { Prisma } from '@prisma/client'
import { ratearCustoFrete } from './ratear-custo-frete.js'
import { servicoVinculoCte } from './servico-vinculo-cte.js'
import {
  mensagemBloqueioConsolidar,
  notaJaLiberadaOuConsolidada,
  podeConsolidarEstoque,
  podeLiberarParaContagem,
  STATUS_AGUARDANDO_CHEGADA,
  STATUS_AGUARDANDO_CONTAGEM,
  STATUS_CONTAGEM_DIVERGENTE,
  STATUS_CONTAGEM_OK,
  STATUS_PAINEL_CONTAGEM,
} from './status-entrada-contagem.js'
import { gerarTitulosContasPagarDaEntrada } from '../contas-a-pagar/gerar-titulos-entrada.js'
import {
  extrairFlagsFornecedorDaNota,
  resolverModoDocumentalEntrada,
  type FlagsFornecedorEntrada,
} from './resolver-modo-documental-entrada.js'
import {
  servicoDeEstoque,
  type ResultadoEntradaNotaFiscal,
} from '../estoque/servico-estoque.js'
import { arredondarQtd } from '../estoque/tipos-estoque.js'
import { obterPessoaIdsRedePorPessoaId } from '../fornecedores/vinculos-fornecedor.js'
import { repositorioContagens } from '../contagens/repositorio-contagens.js'
import { randomUUID } from 'crypto'
import {
  caminhoAbsolutoAnexoEntradaNota,
  salvarAnexoEntradaNota,
} from './armazenamento-anexo-entrada-nota.js'

type EtapaPipeline = 'cadastro' | 'fiscal' | 'negociacao' | 'frete'

function asJson(valor: AnaliseJson): Prisma.InputJsonValue {
  return valor as unknown as Prisma.InputJsonValue
}

const MSG_AUDITORIA_CHEGADA_PENDENTE =
  'Há divergências de preço ou nome para conferir. Confirme as divergências antes de liberar para contagem.'

async function montarAvaliacaoChegada(
  companyId: string,
  nota: {
    id: string
    fornecedorPessoaId: string | null
    itens: Array<{
      id: string
      nItem: number
      produtoId: string | null
      descricao: string | null
      valorUnitario: unknown
      produto?: {
        nomeVenda?: string | null
        fornecedores?: Array<{ fornecedorPessoaId: string; multiplicadorEntrada: unknown }>
      } | null
    }>
  }
): Promise<AuditoriaChegadaJson> {
  const produtoIds = nota.itens.map((i) => i.produtoId).filter((id): id is string => Boolean(id))
  const ultimaPorProduto = await repositorioEntradaNotas.buscarUltimoPrecoConsolidadoPorProduto(
    companyId,
    produtoIds,
    nota.id
  )
  return avaliarAuditoriaChegada({
    itens: nota.itens.map((i) => ({
      id: i.id,
      nItem: i.nItem,
      produtoId: i.produtoId,
      descricao: i.descricao,
      valorUnitario: decimalNum(i.valorUnitario as never),
      itensPorEmbalagem: resolverItensPorEmbalagem(i.produto?.fornecedores, nota.fornecedorPessoaId),
      nomeSistema: i.produto?.nomeVenda ?? null,
    })),
    ultimaPorProduto,
  })
}

function mesclarChegadaNaAnalise(
  analise: AnaliseJson | null | undefined,
  chegada: AuditoriaChegadaJson
): AnaliseJson {
  const base: AnaliseJson = analise
    ? { ...analise }
    : {
        versao: 1,
        atualizadoEm: new Date().toISOString(),
        cadastro: etapaVazia('ok'),
        fiscal: etapaVazia('ok'),
        negociacao: etapaVazia('ok'),
      }
  return { ...base, chegada }
}

function decimalNum(v: { toNumber?: () => number } | number | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v.toNumber === 'function') return v.toNumber()
  return Number(v)
}

/** Formata Date ou string ISO para `yyyy-mm-dd` (resposta detalhe / stub financeiro). */
function dataIsoDia(valor: Date | string | null | undefined): string | null {
  if (valor == null) return null
  if (typeof valor === 'string') {
    const s = valor.trim()
    if (!s) return null
    return s.length >= 10 ? s.slice(0, 10) : s
  }
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10)
  }
  return null
}

/** Flags de tipo do fornecedor (Consumo/Prestador/exigir itens) para o pipeline. */
async function obterFlagsFornecedorEntrada(
  companyId: string,
  nota: {
    fornecedorPessoaId: string | null
    documentoEmitente: string | null
    fornecedorPessoa?: {
      papeis?: Array<{ dadosFornecedor?: FlagsFornecedorEntrada | null } | null>
    } | null
  }
): Promise<FlagsFornecedorEntrada | null> {
  const doInclude = extrairFlagsFornecedorDaNota(nota)
  if (doInclude) return doInclude

  let pessoaId = nota.fornecedorPessoaId
  if (!pessoaId && nota.documentoEmitente) {
    const fornecedor = await repositorioEntradaNotas.buscarFornecedorPorCnpj(
      companyId,
      nota.documentoEmitente
    )
    pessoaId = fornecedor?.id ?? null
  }
  if (!pessoaId) return null
  return repositorioEntradaNotas.buscarFlagsFornecedorEntrada(pessoaId)
}

/**
 * Itens por embalagem (múltiplo de compra) do vínculo produto × fornecedor da nota.
 * Mesma regra do Pedido de Compra (`multiplicadorEntrada`): sem vínculo válido, retorna 1.
 */
function resolverItensPorEmbalagem(
  fornecedores: Array<{ fornecedorPessoaId: string; multiplicadorEntrada: unknown }> | undefined,
  fornecedorPessoaId: string | null | undefined
): number {
  if (!fornecedorPessoaId || !fornecedores?.length) return 1
  const vinculo = fornecedores.find((f) => f.fornecedorPessoaId === fornecedorPessoaId)
  const valor = decimalNum(vinculo?.multiplicadorEntrada as never)
  return valor != null && Number.isFinite(valor) && valor > 0 ? valor : 1
}

/** Quantidade de entrada (qtd NF × múltiplo de compra), mesma base da UI Cadastro. */
function qtdEntradaDoItem(
  quantidade: number | null | undefined,
  itensPorEmbalagem: number
): number | null {
  if (quantidade == null || !Number.isFinite(quantidade)) return null
  const mult = itensPorEmbalagem > 0 ? itensPorEmbalagem : 1
  return Math.round(quantidade * mult * 1e6) / 1e6
}

/**
 * Peso da linha para rateio: peso unitário do cadastro × qtd entrada.
 * Null se produto sem peso ou qtd inválida.
 */
function pesoLinhaRateioKg(params: {
  pesoUnitarioKg: number | null | undefined
  quantidadeNf: number | null | undefined
  itensPorEmbalagem: number
}): number | null {
  const pesoUnit = params.pesoUnitarioKg
  const qtd = qtdEntradaDoItem(params.quantidadeNf, params.itensPorEmbalagem)
  if (pesoUnit == null || !Number.isFinite(pesoUnit) || pesoUnit <= 0) return null
  if (qtd == null || qtd <= 0) return null
  return Math.round(pesoUnit * qtd * 1e6) / 1e6
}

type ItemNotaParaRateio = {
  id: string
  nItem?: number | null
  descricao?: string | null
  quantidade: unknown
  valorTotal: unknown
  produtoId: string | null
  produto?: {
    nomeVenda?: string | null
    pesoKg?: unknown
    fornecedores?: Array<{ fornecedorPessoaId: string; multiplicadorEntrada: unknown }>
  } | null
}

function montarItensParaRateio(
  itens: ItemNotaParaRateio[],
  fornecedorPessoaId: string | null | undefined
) {
  return itens.map((i) => {
    const itensPorEmbalagem = resolverItensPorEmbalagem(
      i.produto?.fornecedores,
      fornecedorPessoaId
    )
    const quantidade = decimalNum(i.quantidade as never)
    const pesoUnitarioKg = decimalNum(i.produto?.pesoKg as never)
    return {
      id: i.id,
      valorTotal: decimalNum(i.valorTotal as never),
      quantidade,
      pesoLinhaKg: pesoLinhaRateioKg({
        pesoUnitarioKg,
        quantidadeNf: quantidade,
        itensPorEmbalagem,
      }),
      pesoUnitarioKg,
      nItem: i.nItem,
      descricao: i.descricao,
      produtoId: i.produtoId,
      nomeProduto: i.produto?.nomeVenda?.trim() || null,
    }
  })
}

/** Mensagens de bloqueio quando regra = peso e falta peso no cadastro. */
function bloqueiosPesoRateio(
  itensMontados: ReturnType<typeof montarItensParaRateio>
): string[] {
  const bloqueios: string[] = []
  for (const item of itensMontados) {
    if (item.pesoLinhaKg != null && item.pesoLinhaKg > 0) continue
    const rotulo =
      item.nomeProduto ||
      (item.nItem != null ? `item #${item.nItem}` : null) ||
      item.descricao?.trim() ||
      'produto'
    bloqueios.push(
      `Produto "${rotulo}" sem peso cadastrado — informe o peso (kg) no cadastro do produto ou altere a Regra de rateio do frete no fornecedor.`
    )
  }
  return bloqueios
}

/**
 * Pedidos abertos elegíveis na Negociação: sempre pela rede do grupo econômico
 * (emitente + Fornecedores relacionados transitivos). Sem vínculos → só o emitente.
 */
async function listarPedidosAbertosGrupoEconomico(
  companyId: string,
  fornecedorPessoaId: string
) {
  const pessoaIds = await obterPessoaIdsRedePorPessoaId(fornecedorPessoaId, companyId)
  return repositorioEntradaNotas.listarPedidosAbertosFornecedor(companyId, pessoaIds)
}

/**
 * Extrai e grava os itens do XML (NfeRecebidaItem) só quando a nota ainda não
 * tem nenhum — nunca sobrescreve itens já gravados (preserva vínculo/CFOP de entrada
 * já escolhidos). NFS-e/CTe, nota inexistente ou sem XML: no-op silencioso (sem throw)
 * para poder ser chamada em pontos "best effort" (abrir detalhe, BUSCAR, sync, Ver nota).
 */
async function sincronizarItensPendentesDoXml(
  companyId: string,
  notaId: string
): Promise<{ itensAdicionados: number }> {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota || nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte' || !nota.xmlConteudo) {
    return { itensAdicionados: 0 }
  }

  const itens = extrairItensDoXml(nota.xmlConteudo)
  if (itens.length === 0) return { itensAdicionados: 0 }

  const qtd = await repositorioEntradaNotas.contarItens(notaId)
  if (qtd > 0) {
    await repositorioEntradaNotas.backfillUnidadeItensDoXml(notaId, itens)
    return { itensAdicionados: 0 }
  }

  await repositorioEntradaNotas.substituirItensDoXml(notaId, itens)
  return { itensAdicionados: itens.length }
}

/**
 * NFe 55 com resNFe / sem `<det>`: completa na Focus (ciência + XML + fallback JSON).
 * Não chama `analisarNota`/`processarAposXml` (evita recursão). Abrir detalhe
 * passa `importarFocusSeAusente: false` — só Reanalisar/BUSCAR/sync usam isto.
 *
 * Após ciência a Focus busca o XML na SEFAZ de forma assíncrona: o `.xml` pode
 * ainda voltar `resNFe`. Nesses casos usamos `completa=1` (`requisicao_nota_fiscal.itens`).
 */
async function completarXmlNfeNaFocusSePreciso(
  companyId: string,
  notaId: string
): Promise<{ ok: boolean; mensagem?: string; itensViaJson?: number }> {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) return { ok: false, mensagem: 'Nota não encontrada' }
  if (nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') {
    return { ok: true }
  }
  if (nota.xmlConteudo && xmlNfeTemItensParseaveis(nota.xmlConteudo)) {
    return { ok: true }
  }

  const cfg = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  const tokenEnv = process.env.FOCUS_NFE_TOKEN?.trim() || null
  const apiToken =
    cfg?.ativo && cfg.apiToken?.trim()
      ? cfg.apiToken.trim()
      : cfg?.apiToken?.trim() || tokenEnv
  if (!apiToken) {
    return {
      ok: false,
      mensagem: 'Configure o token Focus NFe para completar o XML desta nota.',
    }
  }
  const homologacao =
    cfg?.ativo && cfg.apiToken
      ? cfg.homologacao
      : (process.env.FOCUS_NFE_HOMOLOGACAO ?? 'true').trim().toLowerCase() !== 'false'

  const empresa = await repositorioFocusNfe.buscarEmpresaCnpj(companyId)
  const cnpjEmpresa = empresa?.cnpj ?? null

  // Ciência: mesmo se o banco já marcar ciência, força quando XML ainda é resumo
  // (Focus trata duplicidade 573 como sucesso e dispara a busca do XML completo).
  const manResp = await clienteFocusNfe.manifestar(
    apiToken,
    homologacao,
    nota.chaveNfe,
    'ciencia',
    undefined,
    cnpjEmpresa
  )
  if (manResp && !manResp.sucesso && manResp.codigoHttp === 429) {
    await repositorioFocusNfe.atualizarDanfe(nota.id, {
      danfeStatus: 'rate_limit',
      danfeAtualizadoEm: new Date(),
    })
    return {
      ok: false,
      mensagem: `Limite Focus excedido ao preparar ciência. Aguarde e use Reanalisar. (${manResp.mensagem})`,
    }
  }

  async function baixarXmlAtual(): Promise<string | null> {
    const xmlResp = await clienteFocusNfe.baixarXml(
      apiToken!,
      homologacao,
      nota!.chaveNfe,
      cnpjEmpresa
    )
    if (!xmlResp || !xmlResp.sucesso || typeof xmlResp.dados !== 'string') {
      const msg =
        xmlResp && xmlResp.sucesso === false
          ? xmlResp.mensagem
          : 'Focus devolveu XML vazio.'
      const eh429 = Boolean(xmlResp && xmlResp.sucesso === false && xmlResp.codigoHttp === 429)
      if (eh429) {
        await repositorioFocusNfe.atualizarDanfe(nota!.id, {
          danfeStatus: 'rate_limit',
          danfeAtualizadoEm: new Date(),
        })
      }
      logFocus('warn', 'reanalisar_xml_focus_falhou', {
        companyId,
        notaId,
        chave: nota!.chaveNfe,
        mensagem: msg,
        codigoHttp: xmlResp && xmlResp.sucesso === false ? xmlResp.codigoHttp : null,
      })
      return null
    }
    return xmlResp.dados
  }

  let xml = await baixarXmlAtual()
  if (xml && !xmlNfeTemItensParseaveis(xml)) {
    // Focus ainda não materializou o XML após ciência — espera e tenta de novo.
    await new Promise((r) => setTimeout(r, 2500))
    const retry = await baixarXmlAtual()
    if (retry) xml = retry
  }

  let itensJson: ItemXmlNfe[] = []
  let modFreteJson: string | null = null
  if (!xml || !xmlNfeTemItensParseaveis(xml)) {
    const consulta = await clienteFocusNfe.consultarNfeRecebida(
      apiToken,
      homologacao,
      nota.chaveNfe,
      { cnpj: cnpjEmpresa, completa: true }
    )
    if (consulta?.sucesso && consulta.dados && typeof consulta.dados === 'object') {
      const dados = consulta.dados as Record<string, unknown>
      itensJson = extrairItensDoJsonFocusCompleta(dados)
      const req = dados.requisicao_nota_fiscal
      if (req && typeof req === 'object') {
        const mf = (req as { modalidade_frete?: unknown }).modalidade_frete
        if (mf != null && String(mf).trim() !== '') modFreteJson = String(mf).trim()
      }
      logFocus('info', 'reanalisar_xml_fallback_json', {
        companyId,
        notaId,
        chave: nota.chaveNfe,
        itensJson: itensJson.length,
        nfeCompletaFocus: dados.nfe_completa ?? null,
      })
    } else if (consulta && !consulta.sucesso) {
      logFocus('warn', 'reanalisar_consulta_completa_falhou', {
        companyId,
        notaId,
        chave: nota.chaveNfe,
        mensagem: consulta.mensagem,
        codigoHttp: consulta.codigoHttp,
      })
    }
  }

  const xmlCompleto = Boolean(xml && xmlNfeTemItensParseaveis(xml))
  if (!xmlCompleto && itensJson.length === 0) {
    logFocus('warn', 'reanalisar_xml_ainda_resumo', {
      companyId,
      notaId,
      chave: nota.chaveNfe,
      bytes: xml?.length ?? 0,
    })
  }

  if (xml) {
    const campos = extrairCamposResumoDoXml(xml)
    await repositorioFocusNfe.upsertNfeRecebida({
      companyId,
      chaveNfe: nota.chaveNfe,
      tipoDocumento: 'nfe55',
      nomeEmitente: decodificarTextoXml(campos.nomeEmitente ?? nota.nomeEmitente),
      documentoEmitente: campos.documentoEmitente ?? nota.documentoEmitente,
      cnpjDestinatario: campos.cnpjDestinatario ?? nota.cnpjDestinatario,
      dataEmissao: campos.dataEmissao ?? nota.dataEmissao,
      valorTotal:
        campos.valorTotal ?? (nota.valorTotal != null ? Number(nota.valorTotal) : null),
      xmlConteudo: xml,
      nfeCompleta: xmlCompleto,
      origem: 'focus',
      modFrete: campos.modFrete ?? modFreteJson ?? undefined,
      manifestacaoDestinatario: 'ciencia',
    })
  }

  if (xmlCompleto) {
    await sincronizarItensPendentesDoXml(companyId, notaId)
    return { ok: true }
  }

  if (itensJson.length > 0) {
    const qtd = await repositorioEntradaNotas.contarItens(notaId)
    if (qtd === 0) {
      await repositorioEntradaNotas.substituirItensDoXml(notaId, itensJson)
    }
    if (modFreteJson && !nota.modFrete) {
      await repositorioEntradaNotas.atualizarNota(notaId, { modFrete: modFreteJson })
    }
    return { ok: true, itensViaJson: itensJson.length }
  }

  return {
    ok: false,
    mensagem:
      'Focus ainda não liberou o XML completo (só resumo DistDFe). Aguarde 1–2 min e Reanalisar de novo, ou Importe o XML da nota.',
  }
}

async function garantirItensDoXml(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') {
    return nota
  }
  if (!nota.xmlConteudo) {
    throw new ErroDaAplicacao('Nota sem XML. Importe o XML ou baixe pela Focus antes de analisar.', 400)
  }

  await sincronizarItensPendentesDoXml(companyId, notaId)

  const campos = extrairCamposResumoDoXml(nota.xmlConteudo)
  if (campos.prazoPagamentoXml && !nota.prazoPagamentoXml) {
    await repositorioEntradaNotas.atualizarNota(notaId, {
      prazoPagamentoXml: campos.prazoPagamentoXml,
    })
  }

  return nota
}

/**
 * Preenche o CFOP de entrada sugerido (Cfop.cfopSugestaoEntradaId) nos itens que ainda
 * não têm escolha gravada. Nunca sobrescreve uma escolha manual já feita pelo usuário.
 */
async function sugerirCfopEntradaItensSemEscolha(
  companyId: string,
  itens: Array<{ id: string; cfop: string | null; cfopEntradaId: string | null }>
) {
  const pendentes = itens.filter((i) => !i.cfopEntradaId && i.cfop)
  if (pendentes.length === 0) return

  const sugestoes = await repositorioEntradaNotas.mapaSugestaoCfopEntradaPorCodigo(
    companyId,
    pendentes.map((i) => i.cfop as string)
  )
  for (const item of pendentes) {
    const sugestao = item.cfop ? sugestoes.get(item.cfop) : undefined
    if (sugestao) {
      await repositorioEntradaNotas.atualizarItem(item.id, { cfopEntradaId: sugestao.id })
    }
  }
}

/**
 * Preenche o CFOP de entrada sugerido no documento CT-e (NfeRecebida.cfopEntradaId)
 * a partir do CFOP do XML (`ide/CFOP`). Só aceita sugestão com Conhecimento de frete.
 * Nunca sobrescreve escolha manual. Retorna true se gravou sugestão.
 */
async function sugerirCfopEntradaCteSemEscolha(
  companyId: string,
  cte: { id: string; tipoDocumento?: string | null; xmlConteudo?: string | null; cfopEntradaId?: string | null }
): Promise<boolean> {
  if (cte.tipoDocumento != null && cte.tipoDocumento !== 'cte') return false
  if (cte.cfopEntradaId || !cte.xmlConteudo) return false

  const cfopXml = extrairCfopDoXmlCte(cte.xmlConteudo)
  if (!cfopXml) return false

  const sugestoes = await repositorioEntradaNotas.mapaSugestaoCfopEntradaPorCodigo(
    companyId,
    [cfopXml],
    { somenteConhecimentoFrete: true }
  )
  const sugestao = sugestoes.get(cfopXml)
  if (!sugestao) return false

  await repositorioEntradaNotas.atualizarNota(cte.id, { cfopEntradaId: sugestao.id })
  return true
}

function cteTemCfopEntradaConhecimentoFrete(cte: {
  cfopEntradaId?: string | null
  cfopEntrada?: { subtipoCfop?: string | null } | null
}): boolean {
  return Boolean(cte.cfopEntradaId) && cfopEhConhecimentoFrete(cte.cfopEntrada?.subtipoCfop)
}

async function carregarRegras(companyId: string): Promise<RegrasFiscaisJson | null> {
  const cfg = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  if (!cfg?.regrasFiscaisJson) return null
  return sanitizarRegrasFiscais(cfg.regrasFiscaisJson as Partial<DadosRegrasFiscais>)
}

/** Cadastro nunca é liberável por senha — só vínculo/cadastro. */
function podeAvancarCadastro(etapa: ResultadoEtapa): boolean {
  return etapa.status !== 'bloqueante'
}

/** Mensagem canônica — bloqueio de CFOP de entrada do item (aba Fiscal); não libera por senha. */
const MSG_CFOP_ENTRADA_ITEM =
  'Informe o CFOP de entrada do(s) item(ns) (sugestão automática indisponível). Use Trocar na aba Fiscal.'

/**
 * Fiscal: CST/CFOP (exigeManifesto) e CFOP de entrada do item nunca liberam;
 * NCM/origem libera com senha.
 */
function podeAvancarFiscal(etapa: ResultadoEtapa, criticasLiberadas: boolean): boolean {
  if (etapa.status !== 'bloqueante') return true
  if (etapa.exigeManifesto || (etapa.bloqueiosNaoLiberaveis?.length ?? 0) > 0) {
    return false
  }
  if (fiscalExigeCfopEntrada(etapa)) return false
  return criticasLiberadas
}

/** Negociação: senha de gerente libera críticas negativas. */
function podeAvancarNegociacao(etapa: ResultadoEtapa, criticasLiberadas: boolean): boolean {
  if (etapa.status !== 'bloqueante') return true
  return criticasLiberadas
}

function fiscalExigeManifesto(etapa: ResultadoEtapa | null | undefined): boolean {
  if (!etapa) return false
  if (etapa.exigeManifesto === true || (etapa.bloqueiosNaoLiberaveis?.length ?? 0) > 0) {
    return true
  }
  // Análises gravadas antes de exigeManifesto: detectar pelo texto do bloqueio.
  // Não confundir com "CFOP de entrada" (classificação na aba Fiscal).
  return (etapa.bloqueios ?? []).some(
    (m) => /sem CFOP(?! de entrada)|sem CST|desconhecimento da opera/i.test(m)
  )
}

/** CFOP de entrada do item vazio — só Trocar; nunca senha / manifesto. */
function fiscalExigeCfopEntrada(etapa: ResultadoEtapa | null | undefined): boolean {
  if (!etapa) return false
  return (etapa.bloqueios ?? []).some((m) => /CFOP de entrada/i.test(m))
}

function exigeCtePorModFrete(modFrete: string | null | undefined): boolean {
  return (modFrete ?? '').trim() === '1'
}

/** Rateio nos produtos só quando frete é por conta do destinatário (modFrete=1). */
function exigeRateioFrete(modFrete: string | null | undefined): boolean {
  return exigeCtePorModFrete(modFrete)
}

function regraRateioFreteCadastro(
  regra: string | null | undefined
): string | null {
  const r = (regra ?? '').trim()
  return r || null
}

function podeAvancarFrete(etapa: ResultadoEtapa | null | undefined): boolean {
  if (!etapa) return true
  return etapa.status !== 'bloqueante'
}

function pipelineProntoParaLancar(
  analise: AnaliseJson | null,
  criticasLiberadas: boolean,
  fornecedorPessoaId: string | null
): { ok: true } | { ok: false; mensagem: string } {
  if (!analise) {
    return { ok: false, mensagem: 'Nota sem análise. Clique em Reanalisar antes de lançar.' }
  }
  if (!podeAvancarCadastro(analise.cadastro)) {
    return {
      ok: false,
      mensagem: fornecedorPessoaId
        ? 'Cadastro bloqueante: vincule os produtos sem vínculo antes de lançar.'
        : 'Cadastro bloqueante: cadastre o fornecedor e vincule os produtos antes de lançar.',
    }
  }
  if (fiscalExigeManifesto(analise.fiscal)) {
    return {
      ok: false,
      mensagem:
        'Fiscal com CST/CFOP impeditivo: use desconhecimento da operação ou devolução — não é possível lançar.',
    }
  }
  if (fiscalExigeCfopEntrada(analise.fiscal)) {
    return {
      ok: false,
      mensagem: MSG_CFOP_ENTRADA_ITEM,
    }
  }
  if (!podeAvancarFiscal(analise.fiscal, criticasLiberadas)) {
    return {
      ok: false,
      mensagem:
        'Fiscal bloqueante (NCM/origem): importe da NF para o produto ou liberar críticas com senha de gerente.',
    }
  }
  if (!podeAvancarNegociacao(analise.negociacao, criticasLiberadas)) {
    return {
      ok: false,
      mensagem:
        'Negociação bloqueante: resolva o pedido/prazo ou liberar críticas com senha de gerente.',
    }
  }
  if (!podeAvancarFrete(analise.frete)) {
    return {
      ok: false,
      mensagem:
        analise.frete?.bloqueios?.[0] ??
        'Frete bloqueante: vincule o CT-e, confira o Valor do Frete, informe o CFOP de entrada ou cadastre a regra de rateio no fornecedor antes de lançar.',
    }
  }
  return { ok: true }
}

async function lancarContagem(
  notaId: string,
  origem: 'automatica' | 'humana',
  statusDestino: string = STATUS_AGUARDANDO_CONTAGEM
) {
  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: statusDestino,
    etapaAtual: 'lancamento',
    origemLancamento: origem,
  })
}

/**
 * Status pós-lançamento: NFe 55 com item de produto (contagem física) fica em
 * `aguardando_chegada` até liberar manualmente para a logística — com ou sem pedido,
 * qualquer tipoCompra. Documental (NFS-e/CT-e / sem produto) segue direto para
 * `entrada_contagem` — regra permanente, DOCUMENTACAO-SISTEMA.md §7.19.
 */
async function statusPosLancamento(nota: {
  tipoDocumento: string | null
  itens: { produtoId: string | null }[]
}): Promise<string> {
  const exigeContagemFisica =
    (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento) && nota.itens.some((i) => i.produtoId)
  return exigeContagemFisica ? STATUS_AGUARDANDO_CHEGADA : STATUS_AGUARDANDO_CONTAGEM
}

const ORDEM_ETAPAS: EtapaPipeline[] = ['frete', 'cadastro', 'fiscal', 'negociacao']

/** Etapas de retorno válidas por tipo de documento (NFS-e/CTe só têm cadastro). */
function etapasVoltarValidas(tipoDocumento: string | null | undefined): EtapaPipeline[] {
  return tipoDocumento === 'nfse' || tipoDocumento === 'cte' ? ['cadastro'] : ORDEM_ETAPAS
}

/** Posição efetiva da nota no pipeline — finalizada conta como além do fim (permite voltar de qualquer etapa). */
function etapaEfetivaAtual(nota: {
  statusEntrada: string
  etapaAtual: string
  analiseJson: unknown
}): EtapaPipeline | 'lancamento' {
  if (notaJaLiberadaOuConsolidada(nota.statusEntrada)) {
    return 'lancamento'
  }
  const motivo = (nota.analiseJson as AnaliseJson | null)?.motivoParada
  if (motivo === 'cadastro' || motivo === 'fiscal' || motivo === 'negociacao' || motivo === 'frete') {
    return motivo
  }
  if (
    nota.etapaAtual === 'cadastro' ||
    nota.etapaAtual === 'fiscal' ||
    nota.etapaAtual === 'negociacao' ||
    nota.etapaAtual === 'frete'
  ) {
    return nota.etapaAtual
  }
  return 'lancamento'
}

/**
 * Volta a nota para uma etapa anterior: reabre se já lançada, limpa o resultado
 * das etapas a partir do destino (recalculadas na reanálise) e para exatamente
 * na etapa escolhida — sem saltar de volta para o bloqueio antigo.
 */
async function voltarEtapa(
  companyId: string,
  notaId: string,
  usuarioId: string,
  etapaDestino: EtapaPipeline
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'cancelada') {
    throw new ErroDaAplicacao('Nota cancelada — não é possível voltar etapa.', 409)
  }
  if (nota.statusEntrada === 'com_problema' || nota.statusEntrada === 'problema_resolvido') {
    throw new ErroDaAplicacao(
      'Nota com problema — não é possível voltar etapa. Resolva ou desconheça a operação.',
      409
    )
  }

  const etapasValidas = etapasVoltarValidas(nota.tipoDocumento)
  if (!etapasValidas.includes(etapaDestino)) {
    throw new ErroDaAplicacao(
      `Etapa "${etapaDestino}" não existe para este tipo de documento.`,
      400
    )
  }

  const atual = etapaEfetivaAtual(nota)
  const indiceAtual = atual === 'lancamento' ? ORDEM_ETAPAS.length : ORDEM_ETAPAS.indexOf(atual)
  const indiceDestino = ORDEM_ETAPAS.indexOf(etapaDestino)
  if (indiceDestino >= indiceAtual) {
    throw new ErroDaAplicacao(
      `Etapa "${etapaDestino}" não é anterior à etapa atual (${atual}).`,
      400
    )
  }
  const analiseAtual: AnaliseJson = (nota.analiseJson as AnaliseJson | null) ?? {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: etapaVazia(),
    fiscal: etapaVazia(),
    negociacao: etapaVazia(),
    autoLancado: false,
    motivoParada: null,
  }

  const analise: AnaliseJson = {
    ...analiseAtual,
    frete: indiceDestino <= ORDEM_ETAPAS.indexOf('frete') ? etapaVazia() : analiseAtual.frete,
    cadastro:
      indiceDestino <= ORDEM_ETAPAS.indexOf('cadastro') ? etapaVazia() : analiseAtual.cadastro,
    fiscal: indiceDestino <= ORDEM_ETAPAS.indexOf('fiscal') ? etapaVazia() : analiseAtual.fiscal,
    negociacao:
      indiceDestino <= ORDEM_ETAPAS.indexOf('negociacao') ? etapaVazia() : analiseAtual.negociacao,
    autoLancado: false,
    motivoParada: null,
  }

  const finalizada = notaJaLiberadaOuConsolidada(nota.statusEntrada)

  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'em_analise',
    origemLancamento: finalizada ? null : nota.origemLancamento,
    analiseJson: asJson(analise),
    etapaAtual: etapaDestino,
    criticasLiberadas:
      indiceDestino <= ORDEM_ETAPAS.indexOf('negociacao') ? false : nota.criticasLiberadas,
  })

  for (const item of nota.itens) {
    const dados: { criticaFiscal?: boolean; criticaNegociacao?: boolean; custoFreteRateado?: null } =
      {}
    if (indiceDestino <= ORDEM_ETAPAS.indexOf('fiscal')) dados.criticaFiscal = false
    if (indiceDestino <= ORDEM_ETAPAS.indexOf('negociacao')) dados.criticaNegociacao = false
    if (indiceDestino <= ORDEM_ETAPAS.indexOf('frete')) dados.custoFreteRateado = null
    if (Object.keys(dados).length > 0) {
      await repositorioEntradaNotas.atualizarItem(item.id, dados)
    }
  }

  logFocus('info', 'voltar_etapa', {
    companyId,
    notaId,
    usuarioId,
    etapaDestino,
    eraFinalizada: finalizada,
  })

  if (nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') {
    return analisarNota(companyId, notaId)
  }
  return analisarNota(companyId, notaId, { pararEm: etapaDestino })
}

/**
 * Roda o pipeline. Se tudo ok (ou críticas liberadas), lança automaticamente para contagem.
 */
/**
 * Documental (NFS-e): só cadastro do emitente; sem fiscal de itens / PO / estoque.
 * Libera para contagem documental se cadastro ok.
 *
 * CTe: cadastro da transportadora + vínculo com NF-e (chave do XML). Não auto-lança
 * sozinho quando há chave referenciada — o frete entra na NF de mercadoria.
 *
 * `importarFocusSeAusente` (default true): Reanalisar/BUSCAR batem Focus pela NF.
 * Abertura do detalhe passa false — só vínculo local.
 */
async function analisarNotaDocumental(
  companyId: string,
  notaId: string,
  tipo: 'nfse' | 'cte',
  opcoesDoc?: { importarFocusSeAusente?: boolean }
): Promise<{
  nota: Record<string, unknown>
  pedidosDisponiveis: Array<{ id: string; numero: number; status: string }>
}> {
  let nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  await repositorioEntradaNotas.atualizarNota(notaId, { statusEntrada: 'em_analise' })

  let falhaImportNfeRef: string | undefined
  if (tipo === 'cte') {
    const importarFocus = opcoesDoc?.importarFocusSeAusente !== false
    const resultadoVinculo = await servicoVinculoCte.tentarVincularCteAutomatico(companyId, notaId, {
      importarFocusSeAusente: importarFocus,
    })
    falhaImportNfeRef = resultadoVinculo.falhaImport
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
    await sugerirCfopEntradaCteSemEscolha(companyId, nota)
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  const cadastro = await analisarCadastro({
    companyId,
    documentoEmitente: nota.documentoEmitente,
    fornecedorPessoaId: nota.fornecedorPessoaId,
    itens: [],
    exigirItens: false,
    aceitarTransportadoraComoEmitente: tipo === 'cte',
  })

  await repositorioEntradaNotas.atualizarNota(notaId, {
    fornecedorPessoaId: cadastro.fornecedorPessoaId,
    etapaAtual: 'servico',
  })

  const rotulo = tipo === 'cte' ? 'CTe' : 'NFS-e'
  const analise: AnaliseJson = {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: cadastro.resultado,
    fiscal: {
      status: 'ok',
      avisos: [`${rotulo}: análise fiscal de itens de produto não se aplica.`],
      bloqueios: [],
    },
    negociacao: {
      status: 'ok',
      avisos: [`${rotulo}: sem vínculo de estoque/PO — liberação documental.`],
      bloqueios: [],
    },
    autoLancado: false,
    motivoParada: null,
  }

  if (!podeAvancarCadastro(cadastro.resultado)) {
    analise.motivoParada = 'cadastro'
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'servico',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId, { jaRetentouVinculoCte: true })
  }

  if (tipo === 'cte') {
    // Recarrega vínculos após possível import Focus no início
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

    const vinculos = nota.vinculosComoCte ?? []
    const chaveRef = nota.chaveNfeReferenciada
    if (vinculos.length === 0) {
      analise.motivoParada = 'vinculo_nfe'
      const bloqueioComChave = falhaImportNfeRef
        ? [
            `CTe referencia a NF ${chaveRef?.slice(-8) ?? ''}…. Tentativa automática de importar pela Focus falhou: ${falhaImportNfeRef}`,
          ]
        : chaveRef
          ? [
              `CTe referencia a NF ${chaveRef.slice(-8)}… (chave ${chaveRef}). NF ainda não está no ERP — use Reanalisar / BUSCAR (Focus) ou importe o XML da NF.`,
            ]
          : [
              'CTe sem chave de NF-e no XML. Vincule manualmente pela tela da NF de mercadoria ou aguarde NF com frete destinatário.',
            ]
      analise.negociacao = {
        status: 'bloqueante',
        avisos: [],
        bloqueios: bloqueioComChave,
      }
      await repositorioEntradaNotas.atualizarNota(notaId, {
        analiseJson: asJson(analise),
        etapaAtual: 'servico',
        statusEntrada: 'em_analise',
      })
      return await obterDetalhe(companyId, notaId, { jaRetentouVinculoCte: true })
    }

    // CT-e vinculado: não lança sozinho — despesa/rateio na NF de mercadoria
    const chaveNfVinculada = vinculos[0]?.nfeRecebida?.chaveNfe
    analise.negociacao = {
      status: 'ok',
      avisos: [
        `CTe vinculado à NF ${chaveNfVinculada?.slice(-8) ?? ''}… — custo e título a pagar saem na NF de mercadoria (aba Frete/CT-e). Não é necessário lançar este CT-e à parte.`,
      ],
      bloqueios: [],
    }
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'servico',
      statusEntrada: 'em_analise',
    })
    // Reanalisa a NF vinculada para liberar gate de frete
    for (const v of vinculos) {
      try {
        await analisarNota(companyId, v.nfeRecebidaId)
      } catch {
        /* NF pode estar finalizada */
      }
    }
    return await obterDetalhe(companyId, notaId, { jaRetentouVinculoCte: true })
  }

  analise.autoLancado = true
  await repositorioEntradaNotas.atualizarNota(notaId, {
    analiseJson: asJson(analise),
    etapaAtual: 'servico',
  })
  await lancarContagem(notaId, 'automatica')
  return await obterDetalhe(companyId, notaId)
}

/** @deprecated alias — NFS-e usa analisarNotaDocumental */
async function analisarNotaNfse(companyId: string, notaId: string) {
  return analisarNotaDocumental(companyId, notaId, 'nfse')
}

async function analisarNotaCte(
  companyId: string,
  notaId: string,
  opcoes?: { importarFocusSeAusente?: boolean }
) {
  return analisarNotaDocumental(companyId, notaId, 'cte', opcoes)
}

async function analisarNota(
  companyId: string,
  notaId: string,
  opcoes?: {
    forcarReparseItens?: boolean
    pararEm?: EtapaPipeline
    /**
     * Default true (Reanalisar / BUSCAR / sync). Abertura do detalhe passa false.
     * NFe 55: completa XML incompleto (resNFe) na Focus antes do pipeline.
     * CT-e: importa NF referenciada ausente na Focus.
     */
    importarFocusSeAusente?: boolean
  }
): Promise<{
  nota: Record<string, unknown>
  pedidosDisponiveis: Array<{ id: string; numero: number; status: string }>
  contasPagarResumo?: {
    gerados: number
    contas: Array<{ id: string; codigo: string; origem: string }>
  }
}> {
  const importarFocus = opcoes?.importarFocusSeAusente !== false
  let avisoXmlFocus: string | null = null

  // Reanalisar: completa XML incompleto (resNFe) na Focus antes do pipeline.
  if (importarFocus) {
    const pre = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
    if (
      pre &&
      pre.tipoDocumento !== 'nfse' &&
      pre.tipoDocumento !== 'cte' &&
      (!pre.xmlConteudo || !xmlNfeTemItensParseaveis(pre.xmlConteudo))
    ) {
      const xmlFocus = await completarXmlNfeNaFocusSePreciso(companyId, notaId)
      if (!xmlFocus.ok && !pre.xmlConteudo) {
        throw new ErroDaAplicacao(
          xmlFocus.mensagem ??
            'Nota sem XML. Importe o XML ou complete o download na Focus antes de analisar.',
          400
        )
      }
      if (!xmlFocus.ok && xmlFocus.mensagem) {
        avisoXmlFocus = xmlFocus.mensagem
        logFocus('warn', 'reanalisar_xml_incompleto', {
          companyId,
          notaId,
          chave: pre.chaveNfe,
          mensagem: xmlFocus.mensagem,
        })
      }
    }
  }

  const base = await garantirItensDoXml(companyId, notaId)
  if (
    notaJaLiberadaOuConsolidada(base.statusEntrada) ||
    base.statusEntrada === 'cancelada' ||
    base.statusEntrada === 'com_problema' ||
    base.statusEntrada === 'problema_resolvido'
  ) {
    throw new ErroDaAplicacao(
      base.statusEntrada === 'com_problema' || base.statusEntrada === 'problema_resolvido'
        ? 'Nota com problema — use tratativas, solução ou desconhecer operação.'
        : 'Nota já finalizada ou cancelada.',
      409
    )
  }

  if (base.tipoDocumento === 'nfse') {
    return analisarNotaNfse(companyId, notaId)
  }
  if (base.tipoDocumento === 'cte') {
    return analisarNotaCte(companyId, notaId, {
      importarFocusSeAusente: opcoes?.importarFocusSeAusente,
    })
  }

  if (opcoes?.forcarReparseItens) {
    // Só reparseia quando o XML tem <det>; senão apagaria itens vindos do JSON Focus.
    const atual = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
    if (atual?.xmlConteudo && xmlNfeTemItensParseaveis(atual.xmlConteudo)) {
      const itens = extrairItensDoXml(atual.xmlConteudo)
      await repositorioEntradaNotas.substituirItensDoXml(notaId, itens)
    }
  }

  let nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  await repositorioEntradaNotas.atualizarNota(notaId, { statusEntrada: 'em_analise' })

  const analise: AnaliseJson = {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: etapaVazia(),
    fiscal: etapaVazia(),
    negociacao: etapaVazia(),
    frete: etapaVazia(),
    autoLancado: false,
    motivoParada: null,
  }

  // --- Gate frete (1ª etapa): destinatário exige CT-e + valor + CFOP + regra; remetente consultivo ---
  let modFrete = nota.modFrete
  if (!modFrete && nota.xmlConteudo) {
    const camposXml = extrairCamposResumoDoXml(nota.xmlConteudo)
    modFrete = camposXml.modFrete ?? null
    if (modFrete) {
      await repositorioEntradaNotas.atualizarNota(notaId, { modFrete })
    }
  }

  if (!nota.fornecedorPessoaId && nota.documentoEmitente) {
    const fornecedor = await repositorioEntradaNotas.buscarFornecedorPorCnpj(
      companyId,
      nota.documentoEmitente
    )
    if (fornecedor) {
      await repositorioEntradaNotas.atualizarNota(notaId, { fornecedorPessoaId: fornecedor.id })
    }
  }

  nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  modFrete = nota.modFrete ?? modFrete

  const qtdCtes = (nota.vinculosComoNfe ?? []).length
  const freteDestinatario = exigeCtePorModFrete(modFrete)

  async function pararEmFreteBloqueante(bloqueio: string) {
    analise.frete = {
      status: 'bloqueante',
      avisos: [],
      bloqueios: [bloqueio],
    }
    analise.motivoParada = 'frete'
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'frete',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  if (freteDestinatario && qtdCtes === 0) {
    return await pararEmFreteBloqueante(
      'Frete por conta do destinatário (modFrete=1): é obrigatório vincular um CT-e. Se não veio no sync, use a aba Frete/CT-e e informe a chave do CT-e (44 dígitos) manualmente.'
    )
  }

  if (freteDestinatario) {
    const valorTotalFrete = resolverTotalTransporteFrete(nota)
    if (valorTotalFrete <= 0) {
      return await pararEmFreteBloqueante(
        'Valor do Frete ausente ou zerado. Vincule um CT-e com valor ou confira o frete no XML da NF antes de continuar.'
      )
    }

    for (const v of nota.vinculosComoNfe ?? []) {
      const cte = v.cteRecebida
      if (!cte) continue
      await sugerirCfopEntradaCteSemEscolha(companyId, {
        id: cte.id,
        tipoDocumento: 'cte',
        xmlConteudo: cte.xmlConteudo,
        cfopEntradaId: cte.cfopEntradaId,
      })
    }

    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

    const cteSemCfopEntrada = (nota.vinculosComoNfe ?? []).find(
      (v) => v.cteRecebida && !cteTemCfopEntradaConhecimentoFrete(v.cteRecebida)
    )
    if (cteSemCfopEntrada) {
      return await pararEmFreteBloqueante(
        'Informe o CFOP de entrada do CT-e com característica Conhecimento de frete (sugestão automática indisponível). Use Trocar na aba Frete/CT-e.'
      )
    }

    const regraRateio = regraRateioFreteCadastro(
      nota.fornecedorPessoa?.papeis?.[0]?.dadosFornecedor?.regraRateioFrete
    )
    if (!regraRateio) {
      return await pararEmFreteBloqueante(
        'Cadastre a Regra de rateio do frete (CT-e) no fornecedor antes de continuar. Sem essa regra não é possível ratear o custo do frete nos itens.'
      )
    }

    const cteSemFinanceiro = (nota.vinculosComoNfe ?? []).find((v) => {
      const cte = v.cteRecebida
      if (!cte) return false
      const stub = cte.despesasEntrada?.[0] ?? null
      return !financeiroFreteStubCompleto(stub)
    })
    if (cteSemFinanceiro) {
      return await pararEmFreteBloqueante(
        'Preencha e salve o Financeiro (prévia) do frete com a Data de vencimento de cada parcela antes de continuar.'
      )
    }

    analise.frete = {
      status: 'ok',
      avisos: [`${qtdCtes} CT-e(s) vinculado(s) — frete destinatário ok.`],
      bloqueios: [],
    }
    // Rateio só após todos os produtos vinculados (aba Cadastro) — limpa prévia precoce.
    await limparCustoFreteItens(nota.itens.map((i) => i.id))
  } else {
    analise.frete = {
      status: 'ok',
      avisos: [
        modFrete
          ? `modFrete=${modFrete} — frete do remetente; etapa consultiva (não aplicável).`
          : 'modFrete ausente no XML — frete não exigido; etapa consultiva.',
      ],
      bloqueios: [],
    }
    await limparCustoFreteItens(nota.itens.map((i) => i.id))
  }

  await repositorioEntradaNotas.atualizarNota(notaId, { etapaAtual: 'frete' })

  if (opcoes?.pararEm === 'frete') {
    analise.motivoParada = null
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'frete',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  // --- Cadastro ---
  const flagsFornecedor = await obterFlagsFornecedorEntrada(companyId, nota)
  const modoDocumental = resolverModoDocumentalEntrada(flagsFornecedor)

  const cadastro = await analisarCadastro({
    companyId,
    documentoEmitente: nota.documentoEmitente,
    fornecedorPessoaId: nota.fornecedorPessoaId,
    modoDocumental,
    itens: nota.itens.map((i) => ({
      id: i.id,
      nItem: i.nItem,
      descricao: i.descricao,
      gtin: i.gtin,
      codigoProduto: i.codigoProduto,
      produtoId: i.produtoId,
      vinculoModo: i.vinculoModo,
    })),
  })

  for (const item of cadastro.itensAtualizados) {
    await repositorioEntradaNotas.atualizarItem(item.id, {
      produtoId: item.produtoId,
      vinculoModo: item.vinculoModo,
      criticaCadastro: item.criticaCadastro,
    })
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    fornecedorPessoaId: cadastro.fornecedorPessoaId,
    etapaAtual: 'cadastro',
  })

  analise.cadastro = cadastro.resultado
  if (avisoXmlFocus && nota.itens.length === 0) {
    const bloqueios = [...(analise.cadastro.bloqueios ?? [])]
    if (!bloqueios.some((b) => b.includes(avisoXmlFocus))) {
      bloqueios.unshift(avisoXmlFocus)
    }
    analise.cadastro = {
      ...analise.cadastro,
      status: 'bloqueante',
      bloqueios,
    }
  }

  // Rateio: só com todos os itens vinculados; peso exige peso no cadastro (sem fallback).
  const syncRateio = await sincronizarRateioAposCadastro(companyId, notaId)
  if (syncRateio.bloqueiosPeso.length > 0) {
    const bloqueios = [...(analise.cadastro.bloqueios ?? []), ...syncRateio.bloqueiosPeso]
    analise.cadastro = {
      ...analise.cadastro,
      status: 'bloqueante',
      bloqueios,
    }
  }

  const cadastroBloqueado = !podeAvancarCadastro(analise.cadastro)
  if (cadastroBloqueado || opcoes?.pararEm === 'cadastro') {
    analise.motivoParada = cadastroBloqueado ? 'cadastro' : null
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'cadastro',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const regras = await carregarRegras(companyId)
  const fiscal = analisarFiscalItens({
    regras,
    itens: nota.itens.map((i) => ({
      id: i.id,
      produtoId: i.produtoId,
      ncm: i.ncm,
      cfop: i.cfop,
      cst: i.cst,
      origem: i.origem,
      produtoNcm: i.produto?.ncm ?? null,
      produtoOrigem: i.produto?.codigoOrigem ?? null,
    })),
  })
  for (const item of fiscal.itensCritica) {
    await repositorioEntradaNotas.atualizarItem(item.id, { criticaFiscal: item.criticaFiscal })
  }
  analise.fiscal = fiscal.resultado
  await repositorioEntradaNotas.atualizarNota(notaId, { etapaAtual: 'fiscal' })

  await sugerirCfopEntradaItensSemEscolha(companyId, nota.itens)

  nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const itensSemCfopEntrada = nota.itens.filter((i) => !i.cfopEntradaId)
  if (itensSemCfopEntrada.length > 0) {
    const jaTemMsg = (analise.fiscal.bloqueios ?? []).some((m) => /CFOP de entrada/i.test(m))
    analise.fiscal = {
      ...analise.fiscal,
      status: 'bloqueante',
      bloqueios: jaTemMsg
        ? analise.fiscal.bloqueios
        : [...(analise.fiscal.bloqueios ?? []), MSG_CFOP_ENTRADA_ITEM],
    }
  }

  const fiscalBloqueado = !podeAvancarFiscal(analise.fiscal, nota.criticasLiberadas)
  if (fiscalBloqueado || opcoes?.pararEm === 'fiscal') {
    analise.motivoParada = fiscalBloqueado ? 'fiscal' : null
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'fiscal',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  let pedido = null as Awaited<ReturnType<typeof repositorioEntradaNotas.buscarPedidoComItens>>
  if (nota.pedidoCompraId) {
    pedido = await repositorioEntradaNotas.buscarPedidoComItens(companyId, nota.pedidoCompraId)
  } else if (nota.fornecedorPessoaId && !modoDocumental) {
    const abertos = await listarPedidosAbertosGrupoEconomico(companyId, nota.fornecedorPessoaId)
    if (abertos.length === 1) {
      pedido = abertos[0]
      await repositorioEntradaNotas.atualizarNota(notaId, { pedidoCompraId: pedido.id })
    } else if (abertos.length > 1) {
      // deixa sem pedido — humano escolhe
      pedido = null
    }
  }

  // Negociação compara a NF contra o saldo PENDENTE do pedido (total menos já consolidado
  // em outras NFes), não contra a quantidade original — permite completar entregas parciais
  // sem liberar excesso além do que ainda falta (regra de status do pedido pós-entrada).
  const consolidadoPorProduto = pedido
    ? await repositorioEntradaNotas.somarConsolidadoPorProduto(companyId, pedido.id, notaId)
    : new Map<string, number>()

  const negociacao = analisarNegociacao({
    itensNf: nota.itens.map((i) => ({
      id: i.id,
      produtoId: i.produtoId,
      quantidade: decimalNum(i.quantidade),
      valorUnitario: decimalNum(i.valorUnitario),
      nomeSistema: i.produto?.nomeVenda,
      descricaoNf: i.descricao,
    })),
    pedido: pedido
      ? {
          id: pedido.id,
          numero: pedido.numero,
          condicaoPagamento: pedido.condicaoPagamento,
          prazosPagamento: pedido.prazosPagamento,
          itens: pedido.itens.map((i) => {
            const quantidadeTotal = decimalNum(i.quantidade) ?? 0
            const consolidado = consolidadoPorProduto.get(i.produtoId) ?? 0
            const pendente = Math.max(0, quantidadeTotal - consolidado)
            return {
              produtoId: i.produtoId,
              quantidade: pendente,
              precoUnitario: decimalNum(i.precoUnitario) ?? 0,
              nome: i.produto?.nomeVenda,
            }
          }),
        }
      : null,
    prazoNf: nota.prazoPagamentoXml,
    prazoInformadoUsuario: nota.prazoPagamentoTexto,
    dataEmissao: nota.dataEmissao,
    modoDocumental,
  })

  for (const item of negociacao.itensCritica) {
    await repositorioEntradaNotas.atualizarItem(item.id, {
      criticaNegociacao: item.criticaNegociacao,
    })
  }
  analise.negociacao = negociacao.resultado
  await repositorioEntradaNotas.atualizarNota(notaId, { etapaAtual: 'negociacao' })

  const negociacaoBloqueada = !podeAvancarNegociacao(negociacao.resultado, nota.criticasLiberadas)
  if (negociacaoBloqueada || opcoes?.pararEm === 'negociacao') {
    analise.motivoParada = negociacaoBloqueada ? 'negociacao' : null
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'negociacao',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  // Auto-lançamento — nunca sem itens parseados
  if (nota.itens.length === 0) {
    analise.autoLancado = false
    analise.motivoParada = 'cadastro'
    analise.cadastro = {
      status: 'bloqueante',
      avisos: [],
      bloqueios: [
        avisoXmlFocus ??
          'Nota sem itens parseados do XML. Reimporte o XML ou complete o download na Focus.',
      ],
    }
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(analise),
      etapaAtual: 'cadastro',
      statusEntrada: 'em_analise',
    })
    return await obterDetalhe(companyId, notaId)
  }

  analise.autoLancado = true
  analise.motivoParada = null
  await aplicarRateioEDespesasFrete(companyId, notaId)
  const statusDestino = await statusPosLancamento(nota)
  await lancarContagem(notaId, 'automatica', statusDestino)
  await repositorioEntradaNotas.atualizarNota(notaId, {
    analiseJson: asJson(analise),
    etapaAtual: 'lancamento',
  })
  logFocus('info', 'entrada_auto_contagem', {
    companyId,
    notaId,
    chave: nota.chaveNfe,
  })
  return await obterDetalhe(companyId, notaId)
}

/**
 * Zera o frete rateado nos itens (frete remetente / sem rateio / vínculos incompletos).
 */
async function limparCustoFreteItens(itemIds: string[]) {
  for (const id of itemIds) {
    await repositorioEntradaNotas.atualizarItem(id, { custoFreteRateado: null })
  }
}

/**
 * Após Cadastro: rateia frete só se todos os itens estiverem vinculados.
 * Regra peso: exige peso unitário no cadastro × qtd entrada; sem fallback.
 * Devolve bloqueios de peso para o pipeline marcar Cadastro como bloqueante.
 */
async function sincronizarRateioAposCadastro(
  companyId: string,
  notaId: string
): Promise<{ bloqueiosPeso: string[] }> {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota || nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') {
    return { bloqueiosPeso: [] }
  }

  if (!exigeRateioFrete(nota.modFrete)) {
    await limparCustoFreteItens(nota.itens.map((i) => i.id))
    return { bloqueiosPeso: [] }
  }

  const vinculos = nota.vinculosComoNfe ?? []
  if (vinculos.length === 0) {
    await limparCustoFreteItens(nota.itens.map((i) => i.id))
    return { bloqueiosPeso: [] }
  }

  if (nota.itens.length === 0 || nota.itens.some((i) => !i.produtoId)) {
    await limparCustoFreteItens(nota.itens.map((i) => i.id))
    return { bloqueiosPeso: [] }
  }

  const regra = regraRateioFreteCadastro(
    nota.fornecedorPessoa?.papeis?.[0]?.dadosFornecedor?.regraRateioFrete
  )
  if (!regra) {
    await limparCustoFreteItens(nota.itens.map((i) => i.id))
    return { bloqueiosPeso: [] }
  }

  const itensMontados = montarItensParaRateio(nota.itens, nota.fornecedorPessoaId)
  if (regra === 'peso') {
    const bloqueios = bloqueiosPesoRateio(itensMontados)
    if (bloqueios.length > 0) {
      await limparCustoFreteItens(nota.itens.map((i) => i.id))
      return { bloqueiosPeso: bloqueios }
    }
  }

  const persistido = await persistirRateioFreteItensComItens(
    companyId,
    notaId,
    nota,
    itensMontados,
    regra
  )
  if (!persistido.ok) {
    // Erros de peso/valor: sobem como bloqueio de Cadastro quando regra = peso
    if (regra === 'peso') {
      return { bloqueiosPeso: persistido.erros }
    }
    return { bloqueiosPeso: [] }
  }
  return { bloqueiosPeso: [] }
}

/**
 * Rateia o custo do frete nos itens (prévia após vínculos completos).
 * Não cria DespesaEntradaDocumento — isso fica no lançamento.
 */
async function persistirRateioFreteItensComItens(
  _companyId: string,
  _notaId: string,
  nota: {
    tipoDocumento?: string | null
    valorTotal?: unknown
    xmlConteudo?: string | null
    vinculosComoNfe?: Array<{
      valorFrete?: unknown
      cteRecebida?: { valorTotal?: unknown } | null
    }> | null
  },
  itensMontados: ReturnType<typeof montarItensParaRateio>,
  regra: string
): Promise<{ ok: boolean; erros: string[] }> {
  const valorTotalFrete = resolverTotalTransporteFrete({
    tipoDocumento: nota.tipoDocumento ?? 'nfe55',
    valorTotal: nota.valorTotal,
    xmlConteudo: nota.xmlConteudo ?? null,
    vinculosComoNfe: nota.vinculosComoNfe ?? [],
  })

  if (valorTotalFrete <= 0) {
    await limparCustoFreteItens(itensMontados.map((i) => i.id))
    return {
      ok: false,
      erros: ['Valor do frete ausente ou zerado — não é possível ratear nos itens.'],
    }
  }

  const rateio = ratearCustoFrete({
    regra,
    valorTotalFrete,
    itens: itensMontados.map((i) => ({
      id: i.id,
      valorTotal: i.valorTotal,
      quantidade: i.quantidade,
      pesoLinhaKg: i.pesoLinhaKg,
    })),
  })

  if (rateio.erros.length > 0) {
    await limparCustoFreteItens(itensMontados.map((i) => i.id))
    return { ok: false, erros: rateio.erros }
  }

  for (const item of rateio.itens) {
    await repositorioEntradaNotas.atualizarItem(item.id, {
      custoFreteRateado: item.custoFreteRateado,
    })
  }
  return { ok: true, erros: [] }
}

/**
 * Rateia custo dos CT-es nos itens (só destinatário) e registra despesa mínima por CT-e.
 */
async function aplicarRateioEDespesasFrete(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota || nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') return

  if (!exigeRateioFrete(nota.modFrete)) {
    await limparCustoFreteItens(nota.itens.map((i) => i.id))
    return
  }

  const vinculos = nota.vinculosComoNfe ?? []
  if (vinculos.length === 0) {
    await limparCustoFreteItens(nota.itens.map((i) => i.id))
    return
  }

  const valorTotalFrete = resolverTotalTransporteFrete(nota)

  const regra = regraRateioFreteCadastro(
    nota.fornecedorPessoa?.papeis?.[0]?.dadosFornecedor?.regraRateioFrete
  )
  if (!regra) {
    throw new ErroDaAplicacao(
      'Cadastre a Regra de rateio do frete (CT-e) no fornecedor antes de lançar.',
      400
    )
  }

  if (nota.itens.length === 0 || nota.itens.some((i) => !i.produtoId)) {
    await limparCustoFreteItens(nota.itens.map((i) => i.id))
  } else {
    const itensMontados = montarItensParaRateio(nota.itens, nota.fornecedorPessoaId)
    if (regra === 'peso') {
      const bloqueios = bloqueiosPesoRateio(itensMontados)
      if (bloqueios.length > 0) {
        throw new ErroDaAplicacao(bloqueios[0], 400)
      }
    }

    if (valorTotalFrete <= 0) {
      throw new ErroDaAplicacao(
        'Valor do frete ausente ou zerado — não é possível ratear nos itens.',
        400
      )
    }

    const rateio = ratearCustoFrete({
      regra,
      valorTotalFrete,
      itens: itensMontados.map((i) => ({
        id: i.id,
        valorTotal: i.valorTotal,
        quantidade: i.quantidade,
        pesoLinhaKg: i.pesoLinhaKg,
      })),
    })

    if (rateio.erros.length > 0) {
      throw new ErroDaAplicacao(rateio.erros[0], 400)
    }

    for (const item of rateio.itens) {
      await repositorioEntradaNotas.atualizarItem(item.id, {
        custoFreteRateado: item.custoFreteRateado,
      })
    }
  }

  for (const v of vinculos) {
    const valor = parcelaFreteDoVinculo(v)
    if (valor <= 0) continue
    const pessoaId = v.cteRecebida?.fornecedorPessoaId ?? null
    await clientePrisma.despesaEntradaDocumento.upsert({
      where: {
        nfeRecebidaId_origem: { nfeRecebidaId: v.cteRecebidaId, origem: 'cte' },
      },
      create: {
        id: randomUUID(),
        companyId,
        nfeRecebidaId: v.cteRecebidaId,
        pessoaId,
        valor,
        status: 'lancado',
        origem: 'cte',
        updatedAt: new Date(),
      },
      update: {
        pessoaId,
        valor,
        status: 'lancado',
        updatedAt: new Date(),
      },
    })
  }
}

async function obterDetalhe(
  companyId: string,
  notaId: string,
  opcoes?: { jaRetentouVinculoCte?: boolean; jaReparouItens?: boolean }
): Promise<{
  nota: Record<string, unknown>
  pedidosDisponiveis: Array<{ id: string; numero: number; status: string }>
}> {
  let nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const statusesAbertos = ['pendente', 'em_analise', 'stand_by']
  if (
    statusesAbertos.includes(nota.statusEntrada) &&
    nota.xmlConteudo &&
    !nota.analiseJson
  ) {
    // Abertura do detalhe: nunca aguarda Focus (fila serial do agendador trava a UI).
    await processarAposXml(companyId, notaId, { importarFocusSeAusente: false })
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  if (
    nota.xmlConteudo &&
    nota.itens.length > 0 &&
    (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento)
  ) {
    await sincronizarItensPendentesDoXml(companyId, notaId)
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  // NFe 55 sem itens: só repara com XML local. Focus fica em Reanalisar / Ver nota / BUSCAR.
  let avisoReparoXml: string | null = null
  if (
    !opcoes?.jaReparouItens &&
    (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento) &&
    nota.statusEntrada !== 'cancelada' &&
    nota.itens.length === 0
  ) {
    let itensAdicionados = 0
    if (nota.xmlConteudo) {
      ;({ itensAdicionados } = await sincronizarItensPendentesDoXml(companyId, notaId))
    }
    if (itensAdicionados === 0 && (!nota.xmlConteudo || !xmlNfeTemItensParseaveis(nota.xmlConteudo))) {
      avisoReparoXml =
        'XML incompleto ou sem itens. Use Reanalisar, Ver nota ou Importar XML / BUSCAR na lista — abrir o detalhe não consulta a Focus.'
      logFocus('info', 'entrada_reparo_xml_adiado_sem_focus', {
        companyId,
        notaId,
        chave: nota.chaveNfe,
        temXml: Boolean(nota.xmlConteudo),
      })
    }
    if (itensAdicionados > 0) {
      const finalizada = notaJaLiberadaOuConsolidada(nota.statusEntrada)
      if (finalizada) {
        await repositorioEntradaNotas.atualizarNota(notaId, {
          statusEntrada: 'em_analise',
          etapaAtual: 'cadastro',
          origemLancamento: null,
        })
        logFocus('warn', 'entrada_reaberta_sem_itens', {
          companyId,
          notaId,
          chave: nota.chaveNfe,
          statusAntes: nota.statusEntrada,
          itensAdicionados,
        })
      }
      return analisarNota(companyId, notaId)
    }
  }

  // CT-e sem vínculo: abertura do detalhe só tenta vínculo LOCAL (sem Focus).
  // Focus fica no Reanalisar / BUSCAR — igual lista com forcarRetryFocus=false.
  // jaRetentouVinculoCte evita loop quando analisarNota retorna via obterDetalhe.
  const semVinculoCte = (nota.vinculosComoCte ?? []).length === 0
  const temChaveRef =
    Boolean(nota.chaveNfeReferenciada) ||
    (nota.tipoDocumento === 'cte' && Boolean(nota.xmlConteudo))
  if (
    !opcoes?.jaRetentouVinculoCte &&
    nota.tipoDocumento === 'cte' &&
    statusesAbertos.includes(nota.statusEntrada) &&
    temChaveRef &&
    semVinculoCte
  ) {
    const vinculoLocal = await servicoVinculoCte.tentarVincularCteAutomatico(companyId, notaId, {
      importarFocusSeAusente: false,
    })
    if (vinculoLocal.vinculado) {
      return analisarNota(companyId, notaId, { importarFocusSeAusente: false })
    }
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
    if (!nota.analiseJson) {
      return analisarNota(companyId, notaId, { importarFocusSeAusente: false })
    }
    // Já tem análise (ex.: vinculo_nfe) — devolve rápido sem martelar Focus.
  }

  // CFOP de entrada do CT-e (próprio documento ou CT-es vinculados à NF)
  let sugeriuCfopCte = false
  if (nota.tipoDocumento === 'cte') {
    sugeriuCfopCte = await sugerirCfopEntradaCteSemEscolha(companyId, nota)
  } else if (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento) {
    for (const v of nota.vinculosComoNfe ?? []) {
      const cte = v.cteRecebida
      if (!cte) continue
      const ok = await sugerirCfopEntradaCteSemEscolha(companyId, {
        id: cte.id,
        tipoDocumento: 'cte',
        xmlConteudo: cte.xmlConteudo,
        cfopEntradaId: cte.cfopEntradaId,
      })
      if (ok) sugeriuCfopCte = true
    }
  }
  if (sugeriuCfopCte) {
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  // Recalcula/limpa frete rateado ao abrir detalhe (evita R$ 0,00 stale / rateio precoce).
  const statusAbertoRateio = ['pendente', 'em_analise', 'stand_by'].includes(nota.statusEntrada)
  if (
    statusAbertoRateio &&
    (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento)
  ) {
    const syncRateio = await sincronizarRateioAposCadastro(companyId, notaId)
    if (syncRateio.bloqueiosPeso.length > 0) {
      const analiseAtual = (nota.analiseJson as {
        cadastro?: { status?: string; avisos?: string[]; bloqueios?: string[] }
        [k: string]: unknown
      } | null) ?? null
      if (analiseAtual) {
        const bloqueios = [
          ...new Set([...(analiseAtual.cadastro?.bloqueios ?? []), ...syncRateio.bloqueiosPeso]),
        ]
        const analiseAtualizada = {
          ...analiseAtual,
          cadastro: {
            ...(analiseAtual.cadastro ?? { avisos: [], bloqueios: [] }),
            status: 'bloqueante' as const,
            avisos: analiseAtual.cadastro?.avisos ?? [],
            bloqueios,
          },
          motivoParada: 'cadastro',
        }
        await repositorioEntradaNotas.atualizarNota(notaId, {
          analiseJson: asJson(analiseAtualizada),
          etapaAtual: 'cadastro',
          statusEntrada: 'em_analise',
        })
      }
    }
    nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
    if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  }

  let pedidosDisponiveis: Array<{
    id: string
    numero: number
    status: string
    fornecedorPessoaId: string
    fornecedorNome: string | null
  }> = []
  if (nota.fornecedorPessoaId) {
    const abertos = await listarPedidosAbertosGrupoEconomico(companyId, nota.fornecedorPessoaId)
    pedidosDisponiveis = abertos.map((p) => ({
      id: p.id,
      numero: p.numero,
      status: p.status,
      fornecedorPessoaId: p.fornecedorPessoaId,
      fornecedorNome: p.fornecedor?.nome ?? null,
    }))
  }

  const codigosVinculo = nota.fornecedorPessoaId
    ? await repositorioEntradaNotas.mapaCodigoOriginalPorProduto(
        nota.fornecedorPessoaId,
        nota.itens.map((i) => i.produtoId).filter((id): id is string => Boolean(id))
      )
    : new Map<string, string>()

  const tipoDoc = nota.tipoDocumento ?? 'nfe55'
  const podeTerEstoque =
    nota.statusEntrada === 'entrada_consolidada' &&
    tipoDoc !== 'nfse' &&
    tipoDoc !== 'cte'
  const estoqueResumo = podeTerEstoque
    ? await servicoDeEstoque.obterResumoEntradaNotaFiscal(companyId, notaId)
    : null
  const estoqueLancado = Boolean(estoqueResumo?.movimentou)
  const gestaoDivergencia = (nota.analiseJson as AnaliseJson | null)?.divergenciaGestao
  const itensBloqueadosResumo =
    nota.statusEntrada === 'entrada_consolidada'
      ? await servicoDeEstoque.obterItensBloqueadosDivergencia(companyId, notaId, {
          desbloqueioEmNota: gestaoDivergencia?.desbloqueioEm ?? null,
        })
      : { itens: [], totais: { itens: 0, aindaBloqueados: 0, desbloqueados: 0 } }
  const itensBloqueados =
    itensBloqueadosResumo.itens.length > 0 ? itensBloqueadosResumo : null

  const contasPagarRows = await clientePrisma.contaPagar.findMany({
    where: {
      companyId,
      nfeRecebidaId: notaId,
    },
    select: {
      id: true,
      codigo: true,
      origem: true,
      status: true,
      valorTotal: true,
      nfeRecebidaId: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  const contasPagar = contasPagarRows.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    origem: c.origem,
    status: c.status,
    valorTotal: decimalNum(c.valorTotal),
    nfeRecebidaId: c.nfeRecebidaId,
  }))

  let auditoriaChegada: (AuditoriaChegadaJson & { pendente: boolean }) | null = null
  if (nota.statusEntrada === STATUS_AGUARDANDO_CHEGADA) {
    const avaliacao = await montarAvaliacaoChegada(companyId, nota)
    const salvo = lerChegadaDeAnalise(nota.analiseJson)
    const aceitoEm =
      salvo?.fingerprint === avaliacao.fingerprint && salvo.aceitoEm ? salvo.aceitoEm : null
    const chegada: AuditoriaChegadaJson = { ...avaliacao, aceitoEm }
    const analiseAtual = (nota.analiseJson as AnaliseJson | null) ?? null
    const precisaGravar =
      salvo?.fingerprint !== chegada.fingerprint || (salvo?.aceitoEm ?? null) !== aceitoEm
    if (precisaGravar) {
      await repositorioEntradaNotas.atualizarNota(notaId, {
        analiseJson: asJson(mesclarChegadaNaAnalise(analiseAtual, chegada)),
      })
    }
    auditoriaChegada = {
      ...chegada,
      pendente: pendenteLiberacaoChegada(avaliacao, { ...chegada, aceitoEm }),
    }
  } else {
    const salvo = lerChegadaDeAnalise(nota.analiseJson)
    if (salvo) {
      auditoriaChegada = { ...salvo, pendente: false }
    }
  }

  let contagemBaixada = false
  let resultadoContagem: {
    sessaoId: string
    status: string
    iniciadoEm: Date | null
    finalizadoEm: Date | null
    baixadaEm: Date | null
    observacao: string | null
    multiNota: boolean
    qtdNotasSessao: number
    totais: { itens: number; ok: number; divergente: number }
    itens: Array<{
      id: string
      produtoId: string
      sku: string | null
      nomeExibicao: string
      unidade: string | null
      qtdEsperada: number
      qtdContada: number
      diferenca: number
      statusItem: string
    }>
  } | null = null
  if (
    nota.statusEntrada === STATUS_CONTAGEM_OK ||
    nota.statusEntrada === STATUS_CONTAGEM_DIVERGENTE ||
    nota.statusEntrada === 'entrada_consolidada'
  ) {
    const sessao = await repositorioContagens.buscarSessaoFinalizadaDaNota(companyId, notaId)
    contagemBaixada = Boolean(sessao?.baixadaEm)
    if (sessao) {
      const itens = (sessao.itens ?? []).map((item) => {
        const qtdEsperada = decimalNum(item.qtdEsperada) ?? 0
        const qtdContada = decimalNum(item.qtdContada) ?? 0
        const sku = item.produto?.sku?.trim() || null
        let nomeExibicao = item.nomeExibicao
        if (sku) {
          const sufixo = ` (${sku})`
          if (nomeExibicao.endsWith(sufixo)) {
            nomeExibicao = nomeExibicao.slice(0, -sufixo.length).trimEnd()
          }
        }
        return {
          id: item.id,
          produtoId: item.produtoId,
          sku,
          nomeExibicao,
          unidade: item.unidade,
          qtdEsperada,
          qtdContada,
          diferenca: arredondarQtd(qtdContada - qtdEsperada),
          statusItem: item.statusItem,
        }
      })
      const qtdNotasSessao = sessao.notas.length
      resultadoContagem = {
        sessaoId: sessao.id,
        status: sessao.status,
        iniciadoEm: sessao.iniciadoEm,
        finalizadoEm: sessao.finalizadoEm,
        baixadaEm: sessao.baixadaEm,
        observacao: sessao.observacao,
        multiNota: qtdNotasSessao > 1,
        qtdNotasSessao,
        totais: {
          itens: itens.length,
          ok: itens.filter((i) => i.statusItem === 'ok').length,
          divergente: itens.filter((i) => i.statusItem === 'divergente').length,
        },
        itens,
      }
    }
  }

  return {
    nota: {
      id: nota.id,
      chaveNfe: nota.chaveNfe,
      tipoDocumento: tipoDoc,
      nomeEmitente: decodificarTextoXml(nota.nomeEmitente),
      documentoEmitente: nota.documentoEmitente,
      valorTotal: decimalNum(nota.valorTotal),
      dataEmissao: nota.dataEmissao,
      statusEntrada: nota.statusEntrada,
      manifestacaoDestinatario: nota.manifestacaoDestinatario ?? null,
      origem: nota.origem,
      etapaAtual: nota.etapaAtual,
      nfeCompleta: nota.nfeCompleta,
      criticasLiberadas: nota.criticasLiberadas,
      observacaoContato: nota.observacaoContato,
      pedidoCompraId: nota.pedidoCompraId,
      origemLancamento: nota.origemLancamento,
      problemaDesfecho: nota.problemaDesfecho ?? null,
      problemaMarcadoEm: nota.problemaMarcadoEm ?? null,
      problemaResolvidoEm: nota.problemaResolvidoEm ?? null,
      divergenciaDesfecho: nota.divergenciaDesfecho ?? null,
      divergenciaResolvidaEm: nota.divergenciaResolvidaEm ?? null,
      auditoriaChegada,
      contagemBaixada,
      resultadoContagem,
      itensBloqueados,
      anexoDivergencia: (nota.anexos ?? []).find(
        (a) => a.tipoAnexo === 'negociacao_bloqueio' || a.tipoAnexo === 'ressalva_divergencia'
      )
        ? (() => {
            const a = (nota.anexos ?? []).find(
              (x) => x.tipoAnexo === 'negociacao_bloqueio' || x.tipoAnexo === 'ressalva_divergencia'
            )!
            return { id: a.id, nomeArquivo: a.nomeArquivo, tipoAnexo: a.tipoAnexo }
          })()
        : null,
      anexos: (nota.anexos ?? []).map((a) => ({
        id: a.id,
        tipoAnexo: a.tipoAnexo,
        nomeArquivo: a.nomeArquivo,
        createdAt: a.createdAt,
      })),
      divergenciaGestao: (nota.analiseJson as AnaliseJson | null)?.divergenciaGestao ?? null,
      estoqueLancado,
      estoqueResumo,
      contasPagar,
      avisoReparoXml,
      tratativas: (nota.tratativas ?? []).map((t) => ({
        id: t.id,
        texto: t.texto,
        createdAt: t.createdAt,
        usuario: t.usuario
          ? { id: t.usuario.id, name: t.usuario.name, email: t.usuario.email }
          : null,
      })),
      prazoPagamentoXml: nota.prazoPagamentoXml,
      prazoPagamentoTexto: nota.prazoPagamentoTexto,
      modFrete: nota.modFrete ?? null,
      chaveNfeReferenciada: nota.chaveNfeReferenciada ?? null,
      cfopXml:
        nota.tipoDocumento === 'cte' && nota.xmlConteudo
          ? extrairCfopDoXmlCte(nota.xmlConteudo)
          : null,
      cfopEntrada:
        nota.tipoDocumento === 'cte' && nota.cfopEntrada
          ? {
              id: nota.cfopEntrada.id,
              codigo: nota.cfopEntrada.codigo,
              nome: nota.cfopEntrada.nome,
            }
          : null,
      sugestaoFinanceiroFrete:
        nota.tipoDocumento === 'cte' && nota.xmlConteudo
          ? extrairSugestaoFinanceiroDoXmlCte(nota.xmlConteudo)
          : null,
      exigeCte: exigeCtePorModFrete(nota.modFrete),
      regraRateioFrete: regraRateioFreteCadastro(
        nota.fornecedorPessoa?.papeis?.[0]?.dadosFornecedor?.regraRateioFrete
      ),
      fornecedor: nota.fornecedorPessoa
        ? (() => {
            const df = nota.fornecedorPessoa.papeis?.[0]?.dadosFornecedor
            const flags: FlagsFornecedorEntrada = {
              tipoRevenda: df?.tipoRevenda ?? false,
              tipoConsumo: df?.tipoConsumo ?? false,
              tipoPrestadorServico: df?.tipoPrestadorServico ?? false,
              exigirItensEntrada: df?.exigirItensEntrada ?? false,
              permitirVinculoManual: df?.permitirVinculoManual ?? false,
            }
            return {
              id: nota.fornecedorPessoa.id,
              nome: nota.fornecedorPessoa.nome,
              cnpj: nota.fornecedorPessoa.cnpj,
              nomeFantasia: nota.fornecedorPessoa.nomeFantasia,
              ...flags,
              modoDocumental: resolverModoDocumentalEntrada(flags),
            }
          })()
        : null,
      analise: sanitizarAnaliseExibicao(nota.tipoDocumento, nota.analiseJson as AnaliseJson | null),
      transporteXml:
        nota.xmlConteudo && (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento)
          ? extrairDadosTransporteDoXmlNfe(nota.xmlConteudo)
          : null,
      ctesVinculados: (nota.vinculosComoNfe ?? []).map((v) => {
        const cte = v.cteRecebida
        const icms = cte?.xmlConteudo ? extrairIcmsDoXmlCte(cte.xmlConteudo) : null
        const cfop = cte?.xmlConteudo ? extrairCfopDoXmlCte(cte.xmlConteudo) : null
        const sugestaoFinanceiroFrete = cte?.xmlConteudo
          ? extrairSugestaoFinanceiroDoXmlCte(cte.xmlConteudo)
          : null
        const despesaStub = cte?.despesasEntrada?.[0] ?? null
        return {
          id: v.id,
          origemVinculo: v.origemVinculo,
          chaveNfeReferenciada: v.chaveNfeReferenciada,
          valorFrete: decimalNum(v.valorFrete),
          icms,
          cfop,
          cfopEntrada: cte?.cfopEntrada
            ? {
                id: cte.cfopEntrada.id,
                codigo: cte.cfopEntrada.codigo,
                nome: cte.cfopEntrada.nome,
              }
            : null,
          sugestaoFinanceiroFrete,
          financeiro: despesaStub
            ? {
                id: despesaStub.id,
                numeroDocumento: despesaStub.numeroDocumento ?? null,
                vencimento: dataIsoDia(despesaStub.vencimento),
                valor: decimalNum(despesaStub.valor),
                status: despesaStub.status,
                parcelas: parcelasJsonParaResposta(despesaStub.parcelas, {
                  numeroDocumento: despesaStub.numeroDocumento ?? null,
                  vencimento: despesaStub.vencimento,
                  valor: decimalNum(despesaStub.valor),
                }),
              }
            : null,
          cte: cte
            ? {
                id: cte.id,
                chaveNfe: cte.chaveNfe,
                nomeEmitente: decodificarTextoXml(cte.nomeEmitente),
                documentoEmitente: cte.documentoEmitente,
                valorTotal: decimalNum(cte.valorTotal),
                dataEmissao: cte.dataEmissao,
                statusEntrada: cte.statusEntrada,
              }
            : null,
        }
      }),
      nfesVinculadas: (nota.vinculosComoCte ?? []).map((v) => ({
        id: v.id,
        origemVinculo: v.origemVinculo,
        nfe: v.nfeRecebida
          ? {
              id: v.nfeRecebida.id,
              chaveNfe: v.nfeRecebida.chaveNfe,
              nomeEmitente: decodificarTextoXml(v.nfeRecebida.nomeEmitente),
              valorTotal: decimalNum(v.nfeRecebida.valorTotal),
              statusEntrada: v.nfeRecebida.statusEntrada,
            }
          : null,
      })),
      despesasFrete: (nota.despesasEntrada ?? []).map((d) => ({
        id: d.id,
        valor: decimalNum(d.valor),
        status: d.status,
        origem: d.origem,
        pessoaId: d.pessoaId,
        numeroDocumento: d.numeroDocumento ?? null,
        vencimento: dataIsoDia(d.vencimento),
        parcelas: parcelasJsonParaResposta(d.parcelas, {
          numeroDocumento: d.numeroDocumento ?? null,
          vencimento: d.vencimento,
          valor: decimalNum(d.valor),
        }),
      })),
      itens: nota.itens.map((i) => {
        const cProd = (i.codigoProduto ?? '').trim().toLowerCase()
        const codigoFornecedorVinculo =
          i.produtoId != null ? (codigosVinculo.get(i.produtoId) ?? '').trim() || null : null
        const noVinculoNorm = (codigoFornecedorVinculo ?? '').toLowerCase()
        const codigoOriginalGravado = Boolean(i.produtoId && cProd && noVinculoNorm === cProd)
        const quantidade = decimalNum(i.quantidade)
        const itensPorEmbalagem = resolverItensPorEmbalagem(
          i.produto?.fornecedores,
          nota.fornecedorPessoaId
        )
        const qtdTotalUn =
          quantidade != null ? Math.round(quantidade * itensPorEmbalagem * 1e6) / 1e6 : null
        return {
          id: i.id,
          nItem: i.nItem,
          descricao: i.descricao,
          gtin: i.gtin,
          codigoProduto: i.codigoProduto,
          ncm: i.ncm,
          cfop: i.cfop,
          cst: i.cst,
          origem: i.origem,
          unidade: i.unidade,
          quantidade,
          valorUnitario: decimalNum(i.valorUnitario),
          valorTotal: decimalNum(i.valorTotal),
          pesoKg: decimalNum(i.pesoKg),
          custoFreteRateado: decimalNum(i.custoFreteRateado),
          produtoId: i.produtoId,
          vinculoModo: i.vinculoModo,
          criticaCadastro: i.criticaCadastro,
          criticaFiscal: i.criticaFiscal,
          criticaNegociacao: i.criticaNegociacao,
          codigoOriginalGravado,
          codigoFornecedorVinculo,
          itensPorEmbalagem,
          qtdTotalUn,
          cfopEntrada: i.cfopEntrada
            ? { id: i.cfopEntrada.id, codigo: i.cfopEntrada.codigo, nome: i.cfopEntrada.nome }
            : null,
          produto: i.produto
            ? {
                id: i.produto.id,
                nomeVenda: i.produto.nomeVenda,
                sku: i.produto.sku,
                codigoBarras: i.produto.codigoBarras,
                marca: i.produto.marca,
                unidade: i.produto.unidade,
                ncm: i.produto.ncm,
                codigoOrigem: i.produto.codigoOrigem,
                controlaEstoque: i.produto.controlaEstoque,
              }
            : null,
        }
      }),
    },
    pedidosDisponiveis,
  }
}

/** Remove aviso legado de "sem itens" em documentos documentais (NFS-e / CTe). */
function sanitizarAnaliseExibicao(
  tipoDocumento: string | null | undefined,
  analise: AnaliseJson | null
): AnaliseJson | null {
  if (!analise || (tipoDocumento !== 'nfse' && tipoDocumento !== 'cte')) return analise
  const avisoItens = 'Nota sem itens parseados do XML'
  const avisos = (analise.cadastro?.avisos ?? []).filter((a) => !a.includes(avisoItens))
  const bloqueios = analise.cadastro?.bloqueios ?? []
  const statusCadastro =
    bloqueios.length > 0 ? 'bloqueante' : avisos.length > 0 ? 'aviso' : 'ok'
  return {
    ...analise,
    cadastro: {
      ...analise.cadastro,
      status: statusCadastro,
      avisos,
      bloqueios,
    },
  }
}

/**
 * Recalcula só o cadastro (fornecedor + vínculo de itens) e para exatamente aí —
 * não roda fiscal/negociação/frete. Usado após vincular/desvincular **um** item
 * isolado, para não religar automaticamente os demais itens da nota (o usuário
 * concilia um a um; só o Reanalisar roda o pipeline completo de novo).
 */
async function recalcularSomenteCadastro(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const flagsFornecedor = await obterFlagsFornecedorEntrada(companyId, nota)
  const modoDocumental = resolverModoDocumentalEntrada(flagsFornecedor)

  const cadastro = await analisarCadastro({
    companyId,
    documentoEmitente: nota.documentoEmitente,
    fornecedorPessoaId: nota.fornecedorPessoaId,
    modoDocumental,
    itens: nota.itens.map((i) => ({
      id: i.id,
      nItem: i.nItem,
      descricao: i.descricao,
      gtin: i.gtin,
      codigoProduto: i.codigoProduto,
      produtoId: i.produtoId,
      vinculoModo: i.vinculoModo,
    })),
  })

  for (const item of cadastro.itensAtualizados) {
    await repositorioEntradaNotas.atualizarItem(item.id, {
      produtoId: item.produtoId,
      vinculoModo: item.vinculoModo,
      criticaCadastro: item.criticaCadastro,
    })
  }

  let resultadoCadastro = cadastro.resultado
  const syncRateio = await sincronizarRateioAposCadastro(companyId, notaId)
  if (syncRateio.bloqueiosPeso.length > 0) {
    resultadoCadastro = {
      ...resultadoCadastro,
      status: 'bloqueante',
      bloqueios: [...(resultadoCadastro.bloqueios ?? []), ...syncRateio.bloqueiosPeso],
    }
  }

  const analiseAtual: AnaliseJson = (nota.analiseJson as AnaliseJson | null) ?? {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: etapaVazia(),
    fiscal: etapaVazia(),
    negociacao: etapaVazia(),
    autoLancado: false,
    motivoParada: null,
  }
  const analise: AnaliseJson = {
    ...analiseAtual,
    cadastro: resultadoCadastro,
    autoLancado: false,
    motivoParada: podeAvancarCadastro(resultadoCadastro) ? null : 'cadastro',
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    fornecedorPessoaId: cadastro.fornecedorPessoaId,
    statusEntrada: 'em_analise',
    origemLancamento: null,
    analiseJson: asJson(analise),
    etapaAtual: 'cadastro',
  })

  return obterDetalhe(companyId, notaId)
}

async function vincularItem(
  companyId: string,
  notaId: string,
  itemId: string,
  produtoId: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'cancelada') {
    throw new ErroDaAplicacao('Nota cancelada — não é possível vincular produto.', 409)
  }
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item) throw new ErroDaAplicacao('Item não encontrado', 404)
  if (item.produtoId) {
    throw new ErroDaAplicacao(
      'Vínculo travado — item já conciliado. Corrija o cadastro do produto se houver divergência.',
      409
    )
  }

  const produto = await clientePrisma.produto.findFirst({
    where: { id: produtoId, companyId },
    select: { id: true },
  })
  if (!produto) throw new ErroDaAplicacao('Produto não encontrado', 404)

  await repositorioEntradaNotas.atualizarItem(itemId, {
    produtoId,
    vinculoModo: 'manual',
    criticaCadastro: false,
  })

  return recalcularSomenteCadastro(companyId, notaId)
}

/**
 * Endpoint legado: desvincular na entrada está desativado.
 * Itens já vinculados ficam travados — correção de divergência no cadastro do produto.
 */
async function desvincularItem(companyId: string, notaId: string, itemId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'cancelada') {
    throw new ErroDaAplicacao('Nota cancelada — não é possível desvincular produto.', 409)
  }
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item) throw new ErroDaAplicacao('Item não encontrado', 404)
  if (item.produtoId) {
    throw new ErroDaAplicacao(
      'Vínculo travado — não é possível desvincular na entrada. Corrija o cadastro do produto.',
      409
    )
  }

  throw new ErroDaAplicacao('Item sem vínculo de produto para desvincular.', 400)
}

async function gravarCodigoOriginal(companyId: string, notaId: string, itemId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (!nota.fornecedorPessoaId) {
    throw new ErroDaAplicacao('Vincule o fornecedor antes de gravar o código original.', 400)
  }
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item?.produtoId) throw new ErroDaAplicacao('Item sem produto vinculado', 400)
  if (!item.codigoProduto) throw new ErroDaAplicacao('Item sem cProd na NF', 400)

  await repositorioEntradaNotas.gravarCodigoOriginalVinculo(
    item.produtoId,
    nota.fornecedorPessoaId,
    item.codigoProduto
  )
  return { sucesso: true, mensagem: 'Código original gravado no vínculo produto × fornecedor.' }
}

async function importarFiscalProduto(
  companyId: string,
  notaId: string,
  itemId: string,
  campos: { ncm?: boolean; origem?: boolean }
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item?.produtoId) throw new ErroDaAplicacao('Item sem produto vinculado', 400)

  await repositorioEntradaNotas.atualizarFiscalProduto(item.produtoId, companyId, {
    ncm: campos.ncm ? item.ncm : undefined,
    codigoOrigem: campos.origem ? item.origem : undefined,
  })
  return analisarNota(companyId, notaId)
}

/**
 * Troca manualmente o CFOP de entrada de um item (aba Fiscal). Não roda o pipeline
 * inteiro nem muda a regra de bloqueio de CST/CFOP — é só a classificação de entrada.
 */
async function definirCfopEntrada(
  companyId: string,
  notaId: string,
  itemId: string,
  cfopId: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  const item = nota.itens.find((i) => i.id === itemId)
  if (!item) throw new ErroDaAplicacao('Item não encontrado', 404)

  const cfop = await repositorioEntradaNotas.buscarCfopEntradaAtivo(companyId, cfopId)
  if (!cfop) {
    throw new ErroDaAplicacao('CFOP de entrada não encontrado, inativo ou de saída.', 400)
  }

  await repositorioEntradaNotas.atualizarItem(itemId, { cfopEntradaId: cfop.id })
  return obterDetalhe(companyId, notaId)
}

/**
 * Troca manualmente o CFOP de entrada do documento CT-e (aba Frete/CT-e).
 * Não roda o pipeline nem altera gate de frete — só classificação de entrada.
 */
async function definirCfopEntradaCte(companyId: string, cteId: string, cfopId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, cteId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.tipoDocumento !== 'cte') {
    throw new ErroDaAplicacao('CFOP de entrada do frete só se aplica a documentos CT-e.', 400)
  }

  const cfop = await repositorioEntradaNotas.buscarCfopEntradaCteAtivo(companyId, cfopId)
  if (!cfop) {
    throw new ErroDaAplicacao(
      'CFOP de entrada do CT-e deve ser ativo, de entrada/importação e ter a característica Conhecimento de frete.',
      400
    )
  }

  await repositorioEntradaNotas.atualizarNota(cteId, { cfopEntradaId: cfop.id })
  return obterDetalhe(companyId, cteId)
}

async function liberarCriticas(companyId: string, notaId: string, usuarioId: string, senha: string) {
  if (!senha?.trim()) {
    throw new ErroDaAplicacao(
      'Senha de gerente obrigatória para liberar críticas (divergência NCM/origem ou negociação).',
      400
    )
  }
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const analise = nota.analiseJson as AnaliseJson | null
  if (analise?.cadastro?.status === 'bloqueante') {
    throw new ErroDaAplicacao(
      nota.fornecedorPessoaId
        ? 'Cadastro bloqueante não pode ser liberado por senha. Vincule os produtos sem vínculo, depois reanalise.'
        : 'Cadastro bloqueante não pode ser liberado por senha. Cadastre o fornecedor e vincule os produtos, depois reanalise.',
      400
    )
  }
  if (fiscalExigeManifesto(analise?.fiscal)) {
    throw new ErroDaAplicacao(
      'CST/CFOP impeditivo não pode ser liberado por senha. Use desconhecimento da operação ou devolução.',
      400
    )
  }
  if (fiscalExigeCfopEntrada(analise?.fiscal)) {
    throw new ErroDaAplicacao(MSG_CFOP_ENTRADA_ITEM, 400)
  }

  const ok = await servicoDeAutenticacao.verificarSenhaDoUsuario(usuarioId, senha)
  if (!ok) throw new ErroDaAplicacao('Senha inválida.', 403)
  await repositorioEntradaNotas.atualizarNota(notaId, { criticasLiberadas: true })
  return analisarNota(companyId, notaId)
}

async function cancelarLiberacaoCriticas(companyId: string, notaId: string) {
  await repositorioEntradaNotas.atualizarNota(notaId, { criticasLiberadas: false })
  return analisarNota(companyId, notaId)
}

async function contatoFornecedor(companyId: string, notaId: string, observacao: string) {
  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'stand_by',
    observacaoContato: observacao,
    etapaAtual: 'negociacao',
  })
  return obterDetalhe(companyId, notaId)
}

async function definirPedido(companyId: string, notaId: string, pedidoCompraId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const pedido = await repositorioEntradaNotas.buscarPedidoComItens(companyId, pedidoCompraId)
  if (!pedido) throw new ErroDaAplicacao('Pedido não encontrado', 404)

  if (!nota.fornecedorPessoaId) {
    throw new ErroDaAplicacao(
      'Nota sem fornecedor vinculado — vincule o emitente antes de selecionar o pedido.',
      400
    )
  }

  const pessoaIdsRede = await obterPessoaIdsRedePorPessoaId(nota.fornecedorPessoaId, companyId)
  if (!pessoaIdsRede.includes(pedido.fornecedorPessoaId)) {
    throw new ErroDaAplicacao(
      'Pedido não pertence ao grupo econômico do fornecedor da nota.',
      400
    )
  }

  await repositorioEntradaNotas.atualizarNota(notaId, { pedidoCompraId })
  return analisarNota(companyId, notaId)
}

async function definirPrazo(companyId: string, notaId: string, prazo: string) {
  await repositorioEntradaNotas.atualizarNota(notaId, { prazoPagamentoTexto: prazo })
  return analisarNota(companyId, notaId)
}

async function manifestar(
  companyId: string,
  notaId: string,
  tipo: 'desconhecimento' | 'nao_realizada',
  justificativa?: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'problema_resolvido') {
    throw new ErroDaAplicacao('Nota com problema já resolvida — não é possível manifestar.', 409)
  }
  if (
    notaJaLiberadaOuConsolidada(nota.statusEntrada) ||
    nota.statusEntrada === 'cancelada'
  ) {
    throw new ErroDaAplicacao('Nota já finalizada ou cancelada.', 409)
  }

  const cfg = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  if (!cfg?.apiToken) throw new ErroDaAplicacao('Configure o token Focus NFe', 400)

  const tipoApi =
    tipo === 'desconhecimento' ? 'desconhecimento_da_operacao' : 'operacao_nao_realizada'

  await clienteFocusNfe.manifestar(
    cfg.apiToken,
    cfg.homologacao,
    nota.chaveNfe,
    tipoApi,
    justificativa
  )

  const vinhaComProblema = nota.statusEntrada === 'com_problema'
  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'cancelada',
    manifestacaoDestinatario: tipoApi,
    etapaAtual: 'lancamento',
    ...(tipo === 'desconhecimento' && vinhaComProblema
      ? {
          problemaDesfecho: 'desconhecimento',
          problemaResolvidoEm: new Date(),
        }
      : {}),
  })
  return obterDetalhe(companyId, notaId)
}

const STATUS_BLOQUEADOS_MARCAR_PROBLEMA = [
  ...STATUS_PAINEL_CONTAGEM,
  'entrada_consolidada',
  'cancelada',
  'problema_resolvido',
] as const

async function marcarProblema(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'com_problema') {
    return obterDetalhe(companyId, notaId)
  }
  if (
    (STATUS_BLOQUEADOS_MARCAR_PROBLEMA as readonly string[]).includes(nota.statusEntrada)
  ) {
    throw new ErroDaAplicacao(
      'Não é possível marcar esta nota com problema no status atual.',
      409
    )
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'com_problema',
    problemaMarcadoEm: new Date(),
    problemaDesfecho: null,
    problemaResolvidoEm: null,
  })
  return obterDetalhe(companyId, notaId)
}

async function listarTratativas(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  const tratativas = await repositorioEntradaNotas.listarTratativas(companyId, notaId)
  return {
    tratativas: tratativas.map((t) => ({
      id: t.id,
      texto: t.texto,
      createdAt: t.createdAt,
      usuario: t.usuario
        ? { id: t.usuario.id, name: t.usuario.name, email: t.usuario.email }
        : null,
    })),
  }
}

async function adicionarTratativa(
  companyId: string,
  notaId: string,
  usuarioId: string,
  texto: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada !== 'com_problema' && nota.statusEntrada !== 'problema_resolvido') {
    throw new ErroDaAplicacao(
      'Tratativas só podem ser registradas em notas com problema.',
      409
    )
  }
  if (nota.statusEntrada === 'problema_resolvido') {
    throw new ErroDaAplicacao(
      'Nota com problema já resolvida — tratativas ficam somente para consulta.',
      409
    )
  }

  await repositorioEntradaNotas.criarTratativa({
    companyId,
    nfeRecebidaId: notaId,
    usuarioId,
    texto: texto.trim(),
  })
  return obterDetalhe(companyId, notaId)
}

async function resolverProblema(
  companyId: string,
  notaId: string,
  desfecho: 'solucao'
) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada !== 'com_problema') {
    throw new ErroDaAplicacao(
      'Só é possível registrar solução em nota no painel Com problemas.',
      409
    )
  }
  if (desfecho !== 'solucao') {
    throw new ErroDaAplicacao('Desfecho inválido.', 400)
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'problema_resolvido',
    problemaDesfecho: 'solucao',
    problemaResolvidoEm: new Date(),
  })
  return obterDetalhe(companyId, notaId)
}

async function descancelar(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada !== 'cancelada') {
    throw new ErroDaAplicacao('Nota não está cancelada.', 409)
  }

  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'em_analise',
    manifestacaoDestinatario: null,
  })
  return analisarNota(companyId, notaId)
}

/**
 * Monta linhas de estoque a partir dos itens da NFe (após rateio de frete).
 * Itens sem produtoId são ignorados; produto com controlaEstoque e qtd inválida gera erro.
 */
function montarLinhasEstoqueEntradaNf(
  nota: NotaCompletaParaEstoque
): Array<{
  itemId: string
  produtoId: string
  quantidadeEstoque: number
  precoCusto: number | null
  nomeVenda: string | null
}> {
  const linhas: Array<{
    itemId: string
    produtoId: string
    quantidadeEstoque: number
    precoCusto: number | null
    nomeVenda: string | null
  }> = []

  for (const item of nota.itens) {
    if (!item.produtoId) continue

    const quantidadeNf = decimalNum(item.quantidade)
    const itensPorEmbalagem = resolverItensPorEmbalagem(
      item.produto?.fornecedores,
      nota.fornecedorPessoaId
    )
    const quantidadeEstoque =
      quantidadeNf != null
        ? arredondarQtd(quantidadeNf * itensPorEmbalagem)
        : null

    if (
      item.produto?.controlaEstoque === true &&
      (quantidadeEstoque == null || quantidadeEstoque <= 0)
    ) {
      throw new ErroDaAplicacao(
        `Item ${item.nItem}: quantidade inválida para lançar estoque. Verifique o XML e o múltiplo de embalagem.`,
        400
      )
    }
    if (quantidadeEstoque == null || quantidadeEstoque <= 0) continue

    const valorUnitario = decimalNum(item.valorUnitario) ?? 0
    const frete = decimalNum(item.custoFreteRateado) ?? 0
    const qtdNfParaCusto = quantidadeNf != null && quantidadeNf > 0 ? quantidadeNf : null
    let precoCusto: number | null = null
    if (qtdNfParaCusto != null && quantidadeEstoque > 0) {
      const custoLinha = valorUnitario * qtdNfParaCusto + frete
      precoCusto = Math.round((custoLinha / quantidadeEstoque) * 10000) / 10000
    }

    linhas.push({
      itemId: item.id,
      produtoId: item.produtoId,
      quantidadeEstoque,
      precoCusto,
      nomeVenda: item.produto?.nomeVenda ?? null,
    })
  }

  return linhas
}

type NotaCompletaParaEstoque = {
  fornecedorPessoaId: string | null
  itens: Array<{
    id: string
    nItem: number
    produtoId: string | null
    quantidade: { toNumber?: () => number } | number | null
    valorUnitario: { toNumber?: () => number } | number | null
    custoFreteRateado: { toNumber?: () => number } | number | null
    produto?: {
      nomeVenda?: string | null
      controlaEstoque?: boolean
      fornecedores?: Array<{ fornecedorPessoaId: string; multiplicadorEntrada: unknown }>
    } | null
  }>
}

async function lancarEstoqueAoConsolidar(
  companyId: string,
  notaId: string,
  usuarioId: string
): Promise<ResultadoEntradaNotaFiscal | null> {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte') {
    return null
  }

  const linhas = montarLinhasEstoqueEntradaNf(nota)
  if (linhas.length === 0) {
    return {
      movimentou: false,
      itensProcessados: 0,
      itensIgnorados: nota.itens.filter((i) => !i.produtoId).length,
      movimentosGravados: 0,
      produtos: [],
    }
  }

  return servicoDeEstoque.aplicarEntradaNotaFiscal({
    companyId,
    notaId,
    usuarioId,
    pessoaId: nota.fornecedorPessoaId,
    linhas,
  })
}

const TOLERANCIA_QTD_STATUS_PEDIDO = 0.0001

/** Status do pedido em que a transição automática pós-consolidação pode agir. */
const STATUS_PEDIDO_ELEGIVEIS_RECALCULO = ['enviado', 'aprovado', 'parcial']

/**
 * Recalcula o status do Pedido de Compra após uma NFe virar `entrada_consolidada`:
 * todos os itens completos → `recebido` (Concluído); algum consolidado mas não todos →
 * `parcial` (Entregue parcialmente); nada consolidado ainda → não altera.
 * Só aplica sobre pedidos em enviado/aprovado/parcial (não sobrescreve cancelado/rascunho).
 */
async function recalcularStatusPedidoAposConsolidar(
  companyId: string,
  pedidoCompraId: string
): Promise<void> {
  const pedido = await repositorioEntradaNotas.buscarPedidoComItens(companyId, pedidoCompraId)
  if (!pedido) return
  if (!STATUS_PEDIDO_ELEGIVEIS_RECALCULO.includes(pedido.status)) return
  if (pedido.itens.length === 0) return

  const consolidadoPorProduto = await repositorioEntradaNotas.somarConsolidadoPorProduto(
    companyId,
    pedidoCompraId
  )

  let algumConsolidado = false
  let todosCompletos = true
  for (const item of pedido.itens) {
    const quantidadeTotal = decimalNum(item.quantidade) ?? 0
    const consolidado = consolidadoPorProduto.get(item.produtoId) ?? 0
    if (consolidado > TOLERANCIA_QTD_STATUS_PEDIDO) algumConsolidado = true
    const pendente = quantidadeTotal - consolidado
    if (pendente > TOLERANCIA_QTD_STATUS_PEDIDO) todosCompletos = false
  }

  if (!algumConsolidado) return

  const novoStatus = todosCompletos ? 'recebido' : 'parcial'
  if (novoStatus !== pedido.status) {
    await repositorioEntradaNotas.atualizarStatusPedidoCompra(pedidoCompraId, novoStatus)
  }
}

async function lancar(
  companyId: string,
  notaId: string,
  usuarioId: string,
  modo: 'contagem' | 'consolidar',
  senha?: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)

  const noPainelContagem = STATUS_PAINEL_CONTAGEM.includes(nota.statusEntrada)
  const jaConsolidada = nota.statusEntrada === 'entrada_consolidada'
  const exigeContagemFisica =
    (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento) &&
    nota.itens.some((i) => i.produtoId)

  if (jaConsolidada) {
    throw new ErroDaAplicacao('Nota já consolidada.', 409)
  }
  if (modo === 'contagem' && noPainelContagem) {
    throw new ErroDaAplicacao('Nota já liberada para contagem.', 409)
  }
  if (modo === 'contagem' && nota.statusEntrada === STATUS_AGUARDANDO_CHEGADA) {
    throw new ErroDaAplicacao(
      'Nota aguardando chegada — use "Liberar para contagem" antes de lançar novamente.',
      409
    )
  }
  if (nota.statusEntrada === 'cancelada') {
    throw new ErroDaAplicacao('Nota cancelada — não é possível lançar.', 409)
  }
  if (nota.statusEntrada === 'com_problema' || nota.statusEntrada === 'problema_resolvido') {
    throw new ErroDaAplicacao(
      'Nota com problema — não é possível lançar. Resolva ou desconheça a operação.',
      409
    )
  }
  if (
    (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento) &&
    nota.itens.length === 0
  ) {
    throw new ErroDaAplicacao(
      'Nota sem itens parseados do XML. Reimporte o XML ou complete o download na Focus antes de lançar.',
      400
    )
  }

  // Liberada para contagem já passou no gate; consolidar a partir dela não revalida.
  if (!noPainelContagem) {
    const gate = pipelineProntoParaLancar(
      nota.analiseJson as AnaliseJson | null,
      nota.criticasLiberadas,
      nota.fornecedorPessoaId
    )
    if (!gate.ok) {
      throw new ErroDaAplicacao(gate.mensagem, 400)
    }
  }

  let estoqueResumo: ResultadoEntradaNotaFiscal | null = null
  let contasPagarResumo: Awaited<ReturnType<typeof gerarTitulosContasPagarDaEntrada>> | null =
    null

  if (modo === 'consolidar') {
    if (!podeConsolidarEstoque(nota.statusEntrada, { exigeContagemFisica })) {
      throw new ErroDaAplicacao(mensagemBloqueioConsolidar(nota.statusEntrada), 409)
    }
    if (exigeContagemFisica && nota.statusEntrada === STATUS_CONTAGEM_OK) {
      const sessao = await repositorioContagens.buscarSessaoFinalizadaDaNota(companyId, notaId)
      if (!sessao?.baixadaEm) {
        throw new ErroDaAplicacao(
          'Baixe a contagem no administrativo antes de consolidar o estoque.',
          409
        )
      }
    }
    if (!senha) throw new ErroDaAplicacao('Senha de gerente obrigatória para consolidar estoque.', 400)
    const ok = await servicoDeAutenticacao.verificarSenhaDoUsuario(usuarioId, senha)
    if (!ok) throw new ErroDaAplicacao('Senha inválida.', 403)
    await aplicarRateioEDespesasFrete(companyId, notaId)
    contasPagarResumo = await gerarTitulosContasPagarDaEntrada(companyId, notaId, {
      // Legado já em contagem: não trava consolidar se NF não tiver cobr/dup
      exigirVencimentoMercadoria: !noPainelContagem,
    })
    estoqueResumo = await lancarEstoqueAoConsolidar(companyId, notaId, usuarioId)
    await repositorioEntradaNotas.atualizarNota(notaId, {
      statusEntrada: 'entrada_consolidada',
      etapaAtual: 'lancamento',
      origemLancamento: 'humana',
    })
    // Roda depois da nota virar entrada_consolidada — senão a própria nota não entra
    // na soma de "já consolidado" (somarConsolidadoPorProduto filtra por esse status).
    if (nota.pedidoCompraId) {
      await recalcularStatusPedidoAposConsolidar(companyId, nota.pedidoCompraId)
    }
  } else {
    await aplicarRateioEDespesasFrete(companyId, notaId)
    const statusDestino = await statusPosLancamento(nota)
    await lancarContagem(notaId, 'humana', statusDestino)
  }

  const detalhe = await obterDetalhe(companyId, notaId)
  return {
    ...detalhe,
    ...(estoqueResumo != null ? { estoqueResumo } : {}),
    ...(contasPagarResumo != null ? { contasPagarResumo } : {}),
  }
}

/**
 * Libera manualmente uma NF "aguardando chegada" (NFe 55 com produto) para o
 * painel de contagem — única ação de saída desse status (uma nota por vez, sem lote).
 */
async function liberarParaContagem(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (!podeLiberarParaContagem(nota.statusEntrada)) {
    throw new ErroDaAplicacao('Nota não está aguardando chegada.', 409)
  }
  const avaliacao = await montarAvaliacaoChegada(companyId, nota)
  const salvo = lerChegadaDeAnalise(nota.analiseJson)
  if (pendenteLiberacaoChegada(avaliacao, salvo)) {
    await repositorioEntradaNotas.atualizarNota(notaId, {
      analiseJson: asJson(
        mesclarChegadaNaAnalise(nota.analiseJson as AnaliseJson | null, {
          ...avaliacao,
          aceitoEm: salvo?.fingerprint === avaliacao.fingerprint ? salvo.aceitoEm ?? null : null,
        })
      ),
    })
    throw new ErroDaAplicacao(MSG_AUDITORIA_CHEGADA_PENDENTE, 409)
  }
  await repositorioEntradaNotas.atualizarNota(notaId, { statusEntrada: STATUS_AGUARDANDO_CONTAGEM })
  return await obterDetalhe(companyId, notaId)
}

async function aceitarAuditoriaChegada(companyId: string, notaId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (!podeLiberarParaContagem(nota.statusEntrada)) {
    throw new ErroDaAplicacao('Nota não está aguardando chegada.', 409)
  }
  const avaliacao = await montarAvaliacaoChegada(companyId, nota)
  const chegada: AuditoriaChegadaJson = {
    ...avaliacao,
    aceitoEm: avaliacao.achados.length > 0 ? new Date().toISOString() : null,
  }
  await repositorioEntradaNotas.atualizarNota(notaId, {
    analiseJson: asJson(mesclarChegadaNaAnalise(nota.analiseJson as AnaliseJson | null, chegada)),
  })
  return await obterDetalhe(companyId, notaId)
}

async function baixarContagem(
  companyId: string,
  notaId: string,
  usuarioId: string,
  senha?: string
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (
    nota.statusEntrada !== STATUS_CONTAGEM_OK &&
    nota.statusEntrada !== STATUS_CONTAGEM_DIVERGENTE
  ) {
    throw new ErroDaAplicacao(
      'Só é possível baixar contagem após Finalizar OK ou com divergência.',
      409
    )
  }
  const sessao = await repositorioContagens.buscarSessaoFinalizadaDaNota(companyId, notaId)
  if (!sessao) {
    throw new ErroDaAplicacao('Não há sessão de contagem finalizada para esta nota.', 409)
  }
  if (!sessao.baixadaEm) {
    await repositorioContagens.marcarSessaoBaixada(sessao.id)
  }
  if (nota.statusEntrada === STATUS_CONTAGEM_DIVERGENTE) {
    return await obterDetalhe(companyId, notaId)
  }
  return await lancar(companyId, notaId, usuarioId, 'consolidar', senha)
}

async function voltarParaContagem(companyId: string, notaId: string, usuarioId: string) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada === 'entrada_consolidada') {
    throw new ErroDaAplicacao('Nota já consolidada — não é possível voltar para contagem.', 409)
  }
  if (
    nota.statusEntrada !== STATUS_CONTAGEM_OK &&
    nota.statusEntrada !== STATUS_CONTAGEM_DIVERGENTE
  ) {
    throw new ErroDaAplicacao(
      'Só é possível voltar para contagem após Finalizar OK ou com divergência.',
      409
    )
  }
  const sessao = await repositorioContagens.buscarSessaoFinalizadaDaNota(companyId, notaId)
  if (!sessao) {
    throw new ErroDaAplicacao('Não há sessão de contagem finalizada para esta nota.', 409)
  }
  const nfeIds = sessao.notas.map((n) => n.nfeRecebidaId)
  const itensSnapshot = sessao.itens.map((item) => ({
    produtoId: item.produtoId,
    nomeExibicao: item.nomeExibicao,
    sku: item.produto?.sku?.trim() || null,
    qtdContada:
      typeof item.qtdContada === 'object' &&
      item.qtdContada !== null &&
      'toNumber' in item.qtdContada
        ? (item.qtdContada as { toNumber: () => number }).toNumber()
        : Number(item.qtdContada) || 0,
    statusItem: item.statusItem,
  }))
  await repositorioContagens.reabrirSessaoAposBaixa({
    sessaoId: sessao.id,
    nfeRecebidaIds: nfeIds,
    usuarioId,
    itensSnapshot,
    observacao: sessao.observacao,
  })
  return await obterDetalhe(companyId, notaId)
}

/**
 * Resolução administrativa da divergência de contagem (§7.17): bloqueio de itens.
 * Nota inteira (todos os itens com produto) fica retida — devolução fiscal fica para fase
 * futura. Exige senha de gerente (fail-closed), texto de explicação e foto/PDF da
 * negociação. Sem isso não bloqueia. Desbloqueio posterior: `desbloquearEstoqueDivergencia`.
 */
async function resolverDivergenciaContagem(
  companyId: string,
  notaId: string,
  usuarioId: string,
  dados: {
    senha: string
    explicacao: string
    anexo: { mimeType: string; base64Arquivo: string; nomeArquivo: string }
  }
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada !== STATUS_CONTAGEM_DIVERGENTE) {
    throw new ErroDaAplicacao(
      'Nota não está com contagem divergente pendente de correção.',
      409
    )
  }
  const sessao = await repositorioContagens.buscarSessaoFinalizadaDaNota(companyId, notaId)
  if (!sessao?.baixadaEm) {
    throw new ErroDaAplicacao('Baixe a contagem antes de bloquear o estoque.', 409)
  }

  const explicacao = dados.explicacao?.trim() ?? ''
  if (!explicacao) {
    throw new ErroDaAplicacao('Informe a explicação da negociação com o fornecedor.', 400)
  }

  if (!dados.senha?.trim()) {
    throw new ErroDaAplicacao(
      'Senha de gerente obrigatória para resolver a divergência.',
      400
    )
  }
  const senhaOk = await servicoDeAutenticacao.verificarSenhaDoUsuario(usuarioId, dados.senha)
  if (!senhaOk) throw new ErroDaAplicacao('Senha inválida.', 403)

  if (!dados.anexo?.base64Arquivo?.trim() || !dados.anexo?.mimeType?.trim()) {
    throw new ErroDaAplicacao(
      'Foto ou PDF da negociação com o fornecedor é obrigatório para bloquear o estoque.',
      400
    )
  }

  const { caminhoArquivo, tamanhoBytes } = await salvarAnexoEntradaNota(
    notaId,
    dados.anexo.mimeType,
    dados.anexo.base64Arquivo
  )
  await repositorioEntradaNotas.criarAnexoEntradaNota({
    companyId,
    nfeRecebidaId: notaId,
    tipoAnexo: 'negociacao_bloqueio',
    nomeArquivo: dados.anexo.nomeArquivo?.trim() || 'negociacao-bloqueio',
    mimeType: dados.anexo.mimeType,
    caminhoArquivo,
    tamanhoBytes,
    usuarioId,
  })

  // Mesmo passo do Consolidar: rateio + títulos a pagar + lançamento físico/fiscal.
  await aplicarRateioEDespesasFrete(companyId, notaId)
  const contasPagarResumo = await gerarTitulosContasPagarDaEntrada(companyId, notaId, {
    exigirVencimentoMercadoria: false,
  })
  const estoqueResumo = await lancarEstoqueAoConsolidar(companyId, notaId, usuarioId)

  // Bloqueio: cada item com produto e controle de estoque fica com a mesma quantidade
  // da entrada bloqueada (disponível zerado) até desbloqueio (`desbloquearEstoqueDivergencia`).
  const notaParaBloqueio = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!notaParaBloqueio) throw new ErroDaAplicacao('Nota não encontrada', 404)
  const mapaControlaEstoque = new Map(
    notaParaBloqueio.itens.map((i) => [i.id, i.produto?.controlaEstoque === true])
  )
  const linhasEntrada = montarLinhasEstoqueEntradaNf(notaParaBloqueio)
  for (const linha of linhasEntrada) {
    if (!mapaControlaEstoque.get(linha.itemId)) continue
    await servicoDeEstoque.registrarMovimentoEstoque({
      companyId,
      produtoId: linha.produtoId,
      dimensao: 'bloqueio',
      tipoMovimento: 'bloqueio',
      quantidade: linha.quantidadeEstoque,
      origem: 'nfe_divergencia',
      origemId: notaId,
      chaveIdempotencia: `nfe:${notaId}:item:${linha.itemId}:bloqueio`,
      observacao: `Bloqueio por divergência na contagem — ${explicacao}`,
      usuarioId,
    })
  }

  const analiseAtual = (nota.analiseJson as AnaliseJson | null) ?? {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: etapaVazia('ok'),
    fiscal: etapaVazia('ok'),
    negociacao: etapaVazia('ok'),
  }
  await repositorioEntradaNotas.atualizarNota(notaId, {
    statusEntrada: 'entrada_consolidada',
    etapaAtual: 'lancamento',
    origemLancamento: 'humana',
    divergenciaDesfecho: 'bloqueio',
    divergenciaResolvidaEm: new Date(),
    analiseJson: asJson({
      ...analiseAtual,
      divergenciaGestao: {
        ...(analiseAtual.divergenciaGestao ?? {}),
        bloqueioExplicacao: explicacao,
        bloqueioEm: new Date().toISOString(),
      },
    }),
  })

  // Roda depois da nota virar entrada_consolidada (mesmo motivo do Consolidar normal).
  if (nota.pedidoCompraId) {
    await recalcularStatusPedidoAposConsolidar(companyId, nota.pedidoCompraId)
  }

  const detalhe = await obterDetalhe(companyId, notaId)
  return {
    ...detalhe,
    ...(estoqueResumo != null ? { estoqueResumo } : {}),
    ...(contasPagarResumo != null ? { contasPagarResumo } : {}),
  }
}

async function desbloquearEstoqueDivergencia(
  companyId: string,
  notaId: string,
  usuarioId: string,
  dados: {
    senha: string
    explicacao: string
    anexo: { mimeType: string; base64Arquivo: string; nomeArquivo: string }
  }
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.statusEntrada !== 'entrada_consolidada' || nota.divergenciaDesfecho !== 'bloqueio') {
    throw new ErroDaAplicacao('Esta nota não está com estoque bloqueado por divergência.', 409)
  }
  const gestao = (nota.analiseJson as AnaliseJson | null)?.divergenciaGestao
  if (gestao?.desbloqueioEm) {
    const resumoAtual = await servicoDeEstoque.obterItensBloqueadosDivergencia(
      companyId,
      notaId,
      { desbloqueioEmNota: gestao.desbloqueioEm }
    )
    if (resumoAtual.totais.aindaBloqueados === 0) {
      throw new ErroDaAplicacao('Estoque já foi desbloqueado.', 409)
    }
    // Residual de qtd bloqueada (desbloqueio incompleto): permite reprocessar — chaves idempotentes.
  }
  const explicacao = dados.explicacao?.trim() ?? ''
  if (!explicacao) {
    throw new ErroDaAplicacao('Informe a explicação do desbloqueio.', 400)
  }
  if (!dados.senha?.trim()) {
    throw new ErroDaAplicacao('Senha de gerente obrigatória para desbloquear estoque.', 400)
  }
  const senhaOk = await servicoDeAutenticacao.verificarSenhaDoUsuario(usuarioId, dados.senha)
  if (!senhaOk) throw new ErroDaAplicacao('Senha inválida.', 403)
  if (!dados.anexo?.base64Arquivo?.trim() || !dados.anexo?.mimeType?.trim()) {
    throw new ErroDaAplicacao('Foto ou PDF comprovando a negociação é obrigatório.', 400)
  }

  const { caminhoArquivo, tamanhoBytes } = await salvarAnexoEntradaNota(
    notaId,
    dados.anexo.mimeType,
    dados.anexo.base64Arquivo
  )
  await repositorioEntradaNotas.criarAnexoEntradaNota({
    companyId,
    nfeRecebidaId: notaId,
    tipoAnexo: 'negociacao_desbloqueio',
    nomeArquivo: dados.anexo.nomeArquivo?.trim() || 'negociacao-desbloqueio',
    mimeType: dados.anexo.mimeType,
    caminhoArquivo,
    tamanhoBytes,
    usuarioId,
  })

  await servicoDeEstoque.desbloquearMovimentosDivergenciaNota({
    companyId,
    notaId,
    usuarioId,
    observacao: `Desbloqueio após divergência — ${explicacao}`,
  })

  const analiseAtual = (nota.analiseJson as AnaliseJson | null) ?? {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    cadastro: etapaVazia('ok'),
    fiscal: etapaVazia('ok'),
    negociacao: etapaVazia('ok'),
  }
  await repositorioEntradaNotas.atualizarNota(notaId, {
    analiseJson: asJson({
      ...analiseAtual,
      divergenciaGestao: {
        ...(analiseAtual.divergenciaGestao ?? {}),
        desbloqueioExplicacao: explicacao,
        desbloqueioEm: new Date().toISOString(),
      },
    }),
  })
  return await obterDetalhe(companyId, notaId)
}

async function baixarAnexoDivergencia(companyId: string, notaId: string, anexoId: string) {
  const anexo = await repositorioEntradaNotas.buscarAnexoEntradaNota(companyId, notaId, anexoId)
  if (!anexo) throw new ErroDaAplicacao('Anexo não encontrado', 404)
  return {
    caminhoAbsoluto: caminhoAbsolutoAnexoEntradaNota(anexo.caminhoArquivo),
    nomeArquivo: anexo.nomeArquivo,
    mimeType: anexo.mimeType,
  }
}

/**
 * Após import/sync com XML: persiste itens e tenta pipeline automático.
 * `importarFocusSeAusente` (default true): NFe completa XML incompleto na Focus;
 * CT-e importa NF referenciada. Abertura do detalhe passa false.
 */
async function processarAposXml(
  companyId: string,
  notaId: string,
  opcoes?: { importarFocusSeAusente?: boolean }
) {
  try {
    const nota = await repositorioEntradaNotas.buscarNotaPorId(companyId, notaId)
    if (!nota?.xmlConteudo) return
    if (
      notaJaLiberadaOuConsolidada(nota.statusEntrada) ||
      nota.statusEntrada === 'cancelada' ||
      nota.statusEntrada === 'com_problema' ||
      nota.statusEntrada === 'problema_resolvido'
    ) {
      return
    }

    const importarFocus = opcoes?.importarFocusSeAusente !== false

    if (nota.tipoDocumento === 'cte') {
      await servicoVinculoCte.tentarVincularCteAutomatico(companyId, notaId, {
        importarFocusSeAusente: importarFocus,
      })
      await analisarNota(companyId, notaId, { importarFocusSeAusente: importarFocus })
      return
    }

    if (nota.tipoDocumento === 'nfse') {
      await analisarNota(companyId, notaId, { importarFocusSeAusente: importarFocus })
      return
    }

    const xml = normalizarXmlNfe(nota.xmlConteudo)
    const campos = extrairCamposResumoDoXml(xml)
    const itens = extrairItensDoXml(xml)
    await repositorioEntradaNotas.substituirItensDoXml(notaId, itens)
    await repositorioEntradaNotas.atualizarNota(notaId, {
      prazoPagamentoXml: campos.prazoPagamentoXml,
      modFrete: campos.modFrete ?? null,
    })
    await servicoVinculoCte.tentarVincularNfesPendentesAoCte(companyId, notaId)
    await analisarNota(companyId, notaId, { importarFocusSeAusente: importarFocus })
  } catch (erro) {
    logFocus('warn', 'pipeline_apos_xml_falhou', {
      companyId,
      notaId,
      mensagem: erro instanceof Error ? erro.message : String(erro),
    })
  }
}

async function vincularCte(
  companyId: string,
  notaId: string,
  body: { chaveCte?: string; cteId?: string }
) {
  await servicoVinculoCte.vincularCteManual(companyId, notaId, body)
  return analisarNota(companyId, notaId)
}

async function desvincularCte(companyId: string, notaId: string, vinculoId: string) {
  await servicoVinculoCte.desvincularCte(companyId, notaId, vinculoId)
  return analisarNota(companyId, notaId)
}

/**
 * Stub financeiro do frete (prévia contas a pagar): N duplicatas
 * (número, vencimento e valor) em DespesaEntradaDocumento.
 * ContaPagar é gerada só na consolidação (Baixar OK / Consolidar / Bloquear).
 * Soma das parcelas deve bater com o Valor Frete (total do transporte).
 */
const TOLERANCIA_PARCELAS_FRETE = 0.01

type ParcelaFinanceiroFrete = {
  numeroDocumento?: string | null
  vencimento?: string | null
  valor: number
}

function parseVencimentoParcela(raw: string | null | undefined): Date | null {
  if (raw == null || !String(raw).trim()) return null
  const s = String(raw).trim()
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s)
  if (Number.isNaN(d.getTime())) {
    throw new ErroDaAplicacao('Data de vencimento inválida', 400)
  }
  return d
}

function normalizarParcelasFinanceiroFrete(
  dados: {
    parcelas?: ParcelaFinanceiroFrete[]
    numeroDocumento?: string | null
    vencimento?: string | null
    valor?: number
  }
): Array<{ numeroDocumento: string | null; vencimento: Date | null; valor: number }> {
  const origem =
    dados.parcelas != null && dados.parcelas.length > 0
      ? dados.parcelas
      : [
          {
            numeroDocumento: dados.numeroDocumento ?? null,
            vencimento: dados.vencimento ?? null,
            valor: Number(dados.valor),
          },
        ]

  const normalizadas: Array<{
    numeroDocumento: string | null
    vencimento: Date | null
    valor: number
  }> = []

  for (const p of origem) {
    const valor = Number(p.valor)
    if (!Number.isFinite(valor) || valor < 0) {
      throw new ErroDaAplicacao('Valor de parcela inválido', 400)
    }
    if (valor <= 0) {
      throw new ErroDaAplicacao('Informe o valor (R$) de cada parcela', 400)
    }
    normalizadas.push({
      numeroDocumento:
        p.numeroDocumento != null ? String(p.numeroDocumento).trim() || null : null,
      vencimento: parseVencimentoParcela(p.vencimento),
      valor: Math.round(valor * 100) / 100,
    })
  }

  for (const p of normalizadas) {
    if (!p.vencimento) {
      throw new ErroDaAplicacao('Informe a data de vencimento de cada parcela', 400)
    }
  }

  return normalizadas
}

/** Stub Financeiro (prévia) completo: vencimento em todas as duplicatas (regra §7.4). */
function financeiroFreteStubCompleto(
  despesa:
    | {
        vencimento: Date | string | null
        parcelas: unknown
      }
    | null
    | undefined
): boolean {
  if (!despesa) return false
  if (Array.isArray(despesa.parcelas) && despesa.parcelas.length > 0) {
    return despesa.parcelas.every((p) => dataIsoDia((p as { vencimento?: string | Date | null }).vencimento) != null)
  }
  return dataIsoDia(despesa.vencimento) != null
}

function parcelasJsonParaResposta(
  parcelas: unknown,
  fallback: {
    numeroDocumento: string | null
    vencimento: Date | string | null
    valor: number | null
  }
): Array<{
  numeroDocumento: string | null
  vencimento: string | null
  valor: number | null
}> {
  if (Array.isArray(parcelas) && parcelas.length > 0) {
    return parcelas.map((p) => {
      const row = p as {
        numeroDocumento?: string | null
        vencimento?: string | Date | null
        valor?: number | null
      }
      return {
        numeroDocumento: row.numeroDocumento ?? null,
        vencimento: dataIsoDia(row.vencimento ?? null),
        valor: row.valor != null ? Number(row.valor) : null,
      }
    })
  }
  return [
    {
      numeroDocumento: fallback.numeroDocumento,
      vencimento: dataIsoDia(fallback.vencimento),
      valor: fallback.valor,
    },
  ]
}

function resolverTotalTransporteFrete(nota: {
  tipoDocumento: string | null
  valorTotal: unknown
  xmlConteudo: string | null
  vinculosComoNfe?: Array<{
    valorFrete: unknown
    cteRecebida?: { valorTotal: unknown } | null
  }> | null
}): number {
  if (nota.tipoDocumento === 'cte') {
    return decimalNum(nota.valorTotal as { toNumber?: () => number } | number | null) ?? 0
  }
  const vinculos = nota.vinculosComoNfe ?? []
  const somaCtes = vinculos.reduce((acc, v) => {
    const n = parcelaFreteDoVinculo(v)
    return acc + (Number.isFinite(n) ? n : 0)
  }, 0)
  if (somaCtes > 0) return Math.round(somaCtes * 100) / 100
  if (nota.xmlConteudo && (nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento)) {
    const transp = extrairDadosTransporteDoXmlNfe(nota.xmlConteudo)
    const freteNf = transp?.valorFreteNf
    return freteNf != null && Number.isFinite(freteNf) ? Math.round(freteNf * 100) / 100 : 0
  }
  return 0
}

/**
 * Parcela do vínculo: valorFrete > 0; senão valor do CT-e > 0.
 * Evita `valorFrete = 0` travar o fallback via `??`.
 */
function parcelaFreteDoVinculo(v: {
  valorFrete?: unknown
  cteRecebida?: { valorTotal?: unknown } | null
}): number {
  const doVinculo = decimalNum(v.valorFrete as { toNumber?: () => number } | number | null)
  if (doVinculo != null && Number.isFinite(doVinculo) && doVinculo > 0) return doVinculo
  const doCte = decimalNum(v.cteRecebida?.valorTotal as { toNumber?: () => number } | number | null)
  if (doCte != null && Number.isFinite(doCte) && doCte > 0) return doCte
  return 0
}

async function salvarFinanceiroFrete(
  companyId: string,
  notaId: string,
  dados: {
    cteId?: string
    parcelas?: ParcelaFinanceiroFrete[]
    numeroDocumento?: string | null
    vencimento?: string | null
    valor?: number
  }
) {
  const nota = await repositorioEntradaNotas.buscarNotaCompleta(companyId, notaId)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (nota.tipoDocumento === 'nfse') {
    throw new ErroDaAplicacao('Financeiro de frete não se aplica a NFS-e', 400)
  }

  const statusesBloqueados = ['cancelada', 'com_problema', 'problema_resolvido']
  if (statusesBloqueados.includes(nota.statusEntrada)) {
    throw new ErroDaAplicacao('Nota fora do fluxo de entrada', 400)
  }

  let cteId = dados.cteId?.trim() || ''
  if (!cteId) {
    if (nota.tipoDocumento === 'cte') {
      cteId = nota.id
    } else {
      cteId = nota.vinculosComoNfe?.[0]?.cteRecebidaId ?? ''
    }
  }
  if (!cteId) throw new ErroDaAplicacao('Vincule um CT-e antes de gravar o financeiro do frete', 400)

  if (nota.tipoDocumento !== 'cte') {
    const existeCte = nota.vinculosComoNfe?.find((v) => v.cteRecebidaId === cteId)
    if (!existeCte) {
      const existe = await clientePrisma.nfeRecebida.findFirst({
        where: { id: cteId, companyId, tipoDocumento: 'cte' },
        select: { id: true },
      })
      if (!existe) throw new ErroDaAplicacao('CT-e não encontrado', 404)
      throw new ErroDaAplicacao('CT-e não está vinculado a esta NF', 400)
    }
  }

  const parcelas = normalizarParcelasFinanceiroFrete(dados)
  const soma = Math.round(parcelas.reduce((s, p) => s + p.valor, 0) * 100) / 100
  const totalTransporte = resolverTotalTransporteFrete(nota)
  if (totalTransporte <= 0) {
    throw new ErroDaAplicacao('Valor Frete (total do transporte) não encontrado na nota', 400)
  }
  if (Math.abs(soma - totalTransporte) > TOLERANCIA_PARCELAS_FRETE) {
    throw new ErroDaAplicacao(
      `Soma das duplicatas (${soma.toFixed(2)}) difere do Valor Frete / total do transporte (${totalTransporte.toFixed(2)})`,
      400
    )
  }

  const pessoaId =
    nota.tipoDocumento === 'cte'
      ? nota.fornecedorPessoaId
      : (nota.vinculosComoNfe?.find((v) => v.cteRecebidaId === cteId)?.cteRecebida
          ?.fornecedorPessoaId ?? null)

  const primeira = parcelas[0]!
  const parcelasJson = parcelas.map((p) => ({
    numeroDocumento: p.numeroDocumento,
    vencimento: p.vencimento ? p.vencimento.toISOString().slice(0, 10) : null,
    valor: p.valor,
  }))

  await clientePrisma.despesaEntradaDocumento.upsert({
    where: {
      nfeRecebidaId_origem: { nfeRecebidaId: cteId, origem: 'cte' },
    },
    create: {
      id: randomUUID(),
      companyId,
      nfeRecebidaId: cteId,
      pessoaId,
      valor: soma,
      status: 'pendente',
      origem: 'cte',
      numeroDocumento: primeira.numeroDocumento,
      vencimento: primeira.vencimento,
      parcelas: parcelasJson as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
    update: {
      pessoaId,
      valor: soma,
      numeroDocumento: primeira.numeroDocumento,
      vencimento: primeira.vencimento,
      parcelas: parcelasJson as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  })

  // Atualiza gate frete (prévia com vencimento) sem exigir Reanalisar manual
  return analisarNota(companyId, notaId)
}

/**
 * Após cadastrar fornecedor: reanalisa NFs em aberto do mesmo CNPJ/CPF
 * (vincula fornecedor e segue o pipeline sem clique em Reanalisar).
 */
async function reanalisarNotasPendentesPorDocumento(companyId: string, documento: string) {
  const notas = await repositorioEntradaNotas.listarNotasPendentesPorDocumento(
    companyId,
    documento
  )
  let ok = 0
  for (const nota of notas) {
    try {
      await analisarNota(companyId, nota.id)
      ok += 1
    } catch (erro) {
      logFocus('warn', 'reanalise_apos_fornecedor_falhou', {
        companyId,
        notaId: nota.id,
        mensagem: erro instanceof Error ? erro.message : String(erro),
      })
    }
  }
  return ok
}

/**
 * Notas já puxadas sem fornecedor: se o CNPJ/CPF do emitente já existe no cadastro,
 * roda o pipeline (vincula e avança) — sem clique em Reanalisar.
 */
async function vincularFornecedoresNasNotasPendentes(companyId: string) {
  const notas = await repositorioEntradaNotas.listarNotasPendentesSemFornecedor(companyId)
  /** chave = doc + flag CT-e → ids */
  const porChave = new Map<string, { doc: string; aceitarTransportadora: boolean; ids: string[] }>()
  for (const nota of notas) {
    const doc = normalizarDocumento(nota.documentoEmitente ?? '')
    if (!doc) continue
    const aceitarTransportadora = nota.tipoDocumento === 'cte'
    const chave = `${doc}|${aceitarTransportadora ? 't' : 'f'}`
    const atual = porChave.get(chave) ?? { doc, aceitarTransportadora, ids: [] }
    atual.ids.push(nota.id)
    porChave.set(chave, atual)
  }

  let vinculadas = 0
  for (const grupo of porChave.values()) {
    const fornecedor = await repositorioEntradaNotas.buscarFornecedorPorCnpj(companyId, grupo.doc, {
      aceitarTransportadora: grupo.aceitarTransportadora,
    })
    if (!fornecedor) continue
    for (const id of grupo.ids) {
      try {
        await analisarNota(companyId, id)
        vinculadas += 1
      } catch (erro) {
        logFocus('warn', 'vinculo_fornecedor_nota_falhou', {
          companyId,
          notaId: id,
          mensagem: erro instanceof Error ? erro.message : String(erro),
        })
      }
    }
  }

  if (vinculadas > 0) {
    logFocus('info', 'vinculo_fornecedores_pendentes', { companyId, vinculadas })
  }
  return vinculadas
}

/** CT-es sem vínculo: liga NF local; Focus só se houver chave de NF e ela ainda não existir. */
async function processarVinculosCtePendentes(
  companyId: string,
  opcoes?: { importarFocusSeAusente?: boolean; forcarRetryFocus?: boolean }
) {
  return servicoVinculoCte.processarVinculosCtePendentes(companyId, opcoes)
}

/** Remove auto-vínculos CT-e cujo tomador ≠ CNPJ da empresa. */
async function repararVinculosCteTomadorIndevido(companyId: string) {
  return servicoVinculoCte.repararVinculosCteTomadorIndevido(companyId)
}

/** Cancela CT-e Focus legados cujo tomador ≠ CNPJ da empresa. */
async function repararCtesTomadorIndevido(companyId: string) {
  return servicoVinculoCte.repararCtesTomadorIndevido(companyId)
}

async function listarCtesAguardandoNf(companyId: string) {
  return servicoVinculoCte.listarCtesAguardandoNf(companyId)
}

export const servicoEntradaNotas = {
  analisarNota,
  obterDetalhe,
  vincularItem,
  desvincularItem,
  voltarEtapa,
  gravarCodigoOriginal,
  importarFiscalProduto,
  definirCfopEntrada,
  definirCfopEntradaCte,
  liberarCriticas,
  cancelarLiberacaoCriticas,
  contatoFornecedor,
  definirPedido,
  definirPrazo,
  manifestar,
  marcarProblema,
  listarTratativas,
  adicionarTratativa,
  resolverProblema,
  descancelar,
  lancar,
  liberarParaContagem,
  aceitarAuditoriaChegada,
  baixarContagem,
  voltarParaContagem,
  resolverDivergenciaContagem,
  desbloquearEstoqueDivergencia,
  baixarAnexoDivergencia,
  processarAposXml,
  sincronizarItensPendentesDoXml,
  reanalisarNotasPendentesPorDocumento,
  vincularFornecedoresNasNotasPendentes,
  processarVinculosCtePendentes,
  repararVinculosCteTomadorIndevido,
  repararCtesTomadorIndevido,
  listarCtesAguardandoNf,
  vincularCte,
  desvincularCte,
  salvarFinanceiroFrete,
}
