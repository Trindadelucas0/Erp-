/**
 * Regras de negócio Focus NFe / Entrada de Notas (base).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clienteFocusNfe, type NfeRecebidaResumoFocus, type NfseRecebidaResumoFocus, type CteRecebidaResumoFocus, type RespostaFocus } from './cliente-focus-nfe.js'
import { tentarTravarFocus, liberarTravaFocus } from './fila-focus-nfe.js'
import { logFocus } from './logs-focus-nfe.js'
import {
  mascararCnpj,
  mensagemErroFocusAmigavel,
  normalizarCnpj,
} from './mensagens-focus-nfe.js'
import {
  extrairCamposResumoDoXml,
  extrairCnpjTomadorCte,
  normalizarXmlNfe,
  detectarDocumentoFiscalXml,
  montarVisualizacaoDoXml,
  xmlNfeTemItensParseaveis,
} from './parser-xml-nfe.js'
import { repositorioFocusNfe } from './repositorio-focus-nfe.js'
import {
  detectarPdfAuxiliarLegado,
  lerDanfePorCaminho,
  removerArquivoDanfe,
  salvarDanfe,
} from './armazenamento-danfe.js'
import type { DadosParaSalvarConfigFocus, DadosRegrasFiscais } from './esquema-focus-nfe.js'
import { REGRAS_FISCAIS_PADRAO, sanitizarRegrasFiscais } from './esquema-focus-nfe.js'
import { analisarFiscalBasico } from '../entrada-notas/analise-fiscal/analisar-fiscal-basico.js'
import { servicoEntradaNotas } from '../entrada-notas/servico-pipeline-entrada.js'
import { lerConfigCotaFocus, saldoCotaFocus, contarUsoMesFocus } from './cota-focus-nfe.js'
import {
  obterRecursosEntradaNotas,
  type RecursosEntradaNotas,
} from './config-recursos-entrada-notas.js'
function mascararToken(token: string): string {
  if (token.length <= 8) return '****'
  return `${token.slice(0, 4)}${'*'.repeat(token.length - 8)}${token.slice(-4)}`
}

/** Token do .env sem espaços/CRLF acidentais. */
function lerTokenEnvFocus(): string | null {
  const token = process.env.FOCUS_NFE_TOKEN?.trim()
  return token || null
}

/**
 * Homologação via .env: true por padrão.
 * Aceita false/0/nao/não (case-insensitive, com trim) para evitar `false\r` virar homolog=true.
 */
function lerHomologacaoEnvFocus(): boolean {
  const raw = (process.env.FOCUS_NFE_HOMOLOGACAO ?? 'true').trim().toLowerCase()
  if (raw === 'false' || raw === '0' || raw === 'nao' || raw === 'não') return false
  return true
}

async function obterCredenciais(companyId: string) {
  const config = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  if (config?.ativo && config.apiToken) {
    return {
      apiToken: config.apiToken.trim(),
      homologacao: config.homologacao,
      ultimaVersao: config.ultimaVersaoNfeRecebida,
      ultimaVersaoNfse: config.ultimaVersaoNfseRecebida ?? 0,
      ultimaVersaoCte: config.ultimaVersaoCteRecebida ?? 0,
      regrasFiscaisJson: sanitizarRegrasFiscais(
        (config.regrasFiscaisJson as Partial<DadosRegrasFiscais> | null) ?? null
      ),
      fonte: 'banco' as const,
    }
  }

  const tokenEnv = lerTokenEnvFocus()
  if (tokenEnv) {
    return {
      apiToken: tokenEnv,
      homologacao: lerHomologacaoEnvFocus(),
      ultimaVersao: config?.ultimaVersaoNfeRecebida ?? 0,
      ultimaVersaoNfse: config?.ultimaVersaoNfseRecebida ?? 0,
      ultimaVersaoCte: config?.ultimaVersaoCteRecebida ?? 0,
      regrasFiscaisJson: sanitizarRegrasFiscais(
        (config?.regrasFiscaisJson as Partial<DadosRegrasFiscais> | null) ?? null
      ),
      fonte: 'env' as const,
    }
  }

  throw new ErroDaAplicacao(
    'Focus NFe não configurado. Acesse Configurações → Focus NFe ou defina FOCUS_NFE_TOKEN.',
    400
  )
}

async function buscarConfig(companyId: string) {
  const empresa = await repositorioFocusNfe.buscarEmpresaCnpj(companyId)
  const cnpjEmpresa = empresa?.cnpj ? normalizarCnpj(empresa.cnpj) : null
  const cnpjMascarado = cnpjEmpresa ? mascararCnpj(cnpjEmpresa) : null

  const config = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  if (!config) {
    const tokenEnv = lerTokenEnvFocus()
    const temEnv = !!tokenEnv
    return {
      configurado: temEnv,
      homologacao: lerHomologacaoEnvFocus(),
      apiTokenMascarado: temEnv ? mascararToken(tokenEnv) : null,
      ultimaVersaoNfeRecebida: 0,
      regrasFiscaisJson: REGRAS_FISCAIS_PADRAO,
      fonte: temEnv ? 'env' : 'nenhuma',
      cnpjEmpresa,
      cnpjMascarado,
      nomeEmpresa: empresa?.name ?? null,
    }
  }

  return {
    configurado: config.ativo,
    homologacao: config.homologacao,
    apiTokenMascarado: mascararToken(config.apiToken),
    ultimaVersaoNfeRecebida: config.ultimaVersaoNfeRecebida,
    regrasFiscaisJson: sanitizarRegrasFiscais(
      (config.regrasFiscaisJson as Partial<DadosRegrasFiscais> | null) ?? null
    ),
    fonte: 'banco',
    cnpjEmpresa,
    cnpjMascarado,
    nomeEmpresa: empresa?.name ?? null,
  }
}

async function salvarConfig(companyId: string, dados: DadosParaSalvarConfigFocus) {
  await repositorioFocusNfe.salvarConfig(companyId, dados.apiToken.trim(), dados.homologacao)
  logFocus('info', 'config_salva', {
    companyId,
    homologacao: dados.homologacao,
    fonte: 'banco',
  })
  return { sucesso: true }
}

async function salvarRegrasFiscais(companyId: string, dados: DadosRegrasFiscais) {
  const limpas = sanitizarRegrasFiscais(dados)
  const atualizado = await repositorioFocusNfe.salvarRegrasFiscais(companyId, {
    versaoSchema: 1,
    ativo: limpas.ativo,
    checks: limpas.checks,
    observacao: limpas.observacao ?? null,
  })
  if (!atualizado) {
    throw new ErroDaAplicacao(
      'Salve o token Focus desta empresa antes de configurar as regras fiscais (fonte=banco).',
      400
    )
  }
  logFocus('info', 'regras_fiscais_salvas', {
    companyId,
    ativo: limpas.ativo,
    checks: limpas.checks,
  })
  return {
    sucesso: true,
    regrasFiscaisJson: limpas,
  }
}

async function testarConexao(companyId: string) {
  let credenciais
  try {
    credenciais = await obterCredenciais(companyId)
  } catch (e) {
    logFocus('warn', 'config_ausente', { companyId })
    throw e
  }

  const empresa = await repositorioFocusNfe.buscarEmpresaCnpj(companyId)
  if (!empresa?.cnpj) {
    throw new ErroDaAplicacao(
      'Empresa ativa sem CNPJ em Cadastros — necessário para testar NFe recebidas.',
      400
    )
  }

  const cnpj = normalizarCnpj(empresa.cnpj)
  const cnpjMascarado = mascararCnpj(cnpj)
  const ambiente = credenciais.homologacao ? 'homolog' : 'producao'
  const inicio = Date.now()

  logFocus('info', 'teste_conexao_inicio', {
    companyId,
    fonte: credenciais.fonte,
    homologacao: credenciais.homologacao,
    cnpj: cnpjMascarado,
  })

  const resultado = await clienteFocusNfe.testarConexao(
    credenciais.apiToken,
    credenciais.homologacao,
    cnpj
  )
  const ms = Date.now() - inicio

  if (!resultado.sucesso) {
    const mensagem = mensagemErroFocusAmigavel({
      codigoHttp: resultado.codigoHttp,
      mensagemOriginal: resultado.mensagem,
      ambiente,
      cnpjMascarado,
      fonte: credenciais.fonte,
    })
    logFocus('warn', 'teste_conexao', {
      companyId,
      status: 'falha',
      http: resultado.codigoHttp ?? '',
      ms,
      ambiente,
      fonte: credenciais.fonte,
      cnpj: cnpjMascarado,
    })
    return {
      sucesso: false,
      mensagem,
      ambiente,
      fonte: credenciais.fonte,
      cnpjMascarado,
    }
  }

  const qtd = Array.isArray(resultado.dados) ? resultado.dados.length : 0
  logFocus('info', 'teste_conexao', {
    companyId,
    status: 'ok',
    ms,
    ambiente,
    fonte: credenciais.fonte,
    cnpj: cnpjMascarado,
    qtd,
  })
  return {
    sucesso: true,
    mensagem: `Conexão Focus NFe (${ambiente}) OK. CNPJ ${cnpjMascarado} autorizado${
      qtd > 0 ? ` — ${qtd} nota(s) na primeira página.` : ' — nenhuma nota pendente na primeira página.'
    }`,
    ambiente,
    fonte: credenciais.fonte,
    cnpjMascarado,
  }
}

function mapearResumo(item: NfeRecebidaResumoFocus) {
  const nfeCompleta =
    item.nfe_completa === true ||
    item.nfe_completa === 'true' ||
    item.nfe_completa === '1'
  const valor = item.valor_total ? Number(item.valor_total) : null
  return {
    chaveNfe: item.chave_nfe,
    tipoDocumento: 'nfe55' as const,
    nomeEmitente: item.nome_emitente ?? null,
    documentoEmitente: item.documento_emitente ?? null,
    cnpjDestinatario: item.cnpj_destinatario ?? null,
    valorTotal: Number.isFinite(valor) ? valor : null,
    dataEmissao: item.data_emissao ? new Date(item.data_emissao) : null,
    situacao: item.situacao ?? null,
    manifestacaoDestinatario: item.manifestacao_destinatario ?? null,
    nfeCompleta,
    tipoNfe: item.tipo_nfe ?? null,
    versaoFocus: item.versao ?? 0,
  }
}

function chaveNfseFocus(item: NfseRecebidaResumoFocus): string | null {
  const raw = item.chave_nfse ?? item.chave ?? item.chave_acesso
  if (!raw) return null
  return String(raw).trim() || null
}

function mapearResumoNfse(item: NfseRecebidaResumoFocus) {
  const chave = chaveNfseFocus(item)
  const valorRaw = item.valor_servicos ?? item.valor_total
  const valor = valorRaw ? Number(valorRaw) : null
  return {
    chaveNfe: chave!,
    tipoDocumento: 'nfse' as const,
    nomeEmitente: item.nome_prestador ?? null,
    documentoEmitente: item.documento_prestador ?? null,
    cnpjDestinatario: item.documento_tomador ?? item.cnpj_tomador ?? null,
    valorTotal: Number.isFinite(valor as number) ? (valor as number) : null,
    dataEmissao: item.data_emissao ? new Date(item.data_emissao) : null,
    situacao: item.status ?? item.situacao ?? 'autorizada',
    manifestacaoDestinatario: null,
    nfeCompleta: false,
    tipoNfe: null,
    versaoFocus: item.versao ?? 0,
    etapaAtual: 'servico',
  }
}

function chaveCteFocus(item: CteRecebidaResumoFocus): string | null {
  const raw = item.chave_cte ?? item.chave ?? item.chave_acesso
  if (!raw) return null
  return String(raw).trim() || null
}

function mapearResumoCte(item: CteRecebidaResumoFocus) {
  const chave = chaveCteFocus(item)
  const valorRaw = item.valor_prestacao ?? item.valor_total
  const valor = valorRaw ? Number(valorRaw) : null
  return {
    chaveNfe: chave!,
    tipoDocumento: 'cte' as const,
    nomeEmitente: item.nome_emitente ?? null,
    documentoEmitente: item.documento_emitente ?? null,
    // Destinatário ≠ tomador — não misturar documento_tomador aqui.
    cnpjDestinatario: item.documento_destinatario ?? item.cnpj_destinatario ?? null,
    valorTotal: Number.isFinite(valor as number) ? (valor as number) : null,
    dataEmissao: item.data_emissao ? new Date(item.data_emissao) : null,
    situacao: item.status ?? item.situacao ?? 'autorizada',
    manifestacaoDestinatario: null,
    nfeCompleta: false,
    tipoNfe: null,
    versaoFocus: item.versao ?? 0,
    etapaAtual: 'servico',
  }
}

/** CNPJ/CPF do tomador no resumo Focus (quando a API envia). */
function tomadorDoResumoCte(item: CteRecebidaResumoFocus): string | null {
  const raw = item.documento_tomador ?? item.cnpj_tomador ?? null
  if (!raw) return null
  const digitos = normalizarCnpj(String(raw))
  return digitos || null
}

/** true = somos tomador; false = não somos; null = desconhecido (precisa XML). */
function compararTomadorComEmpresa(
  documentoTomador: string | null,
  cnpjEmpresa: string
): boolean | null {
  if (!documentoTomador) return null
  return normalizarCnpj(documentoTomador) === cnpjEmpresa
}

async function avancarCursorCte(
  companyId: string,
  credenciais: { ultimaVersaoCte: number },
  temConfigBanco: boolean,
  maxAtual: number,
  versaoItem: number
): Promise<number> {
  const max = Math.max(maxAtual, versaoItem)
  if (temConfigBanco && max > credenciais.ultimaVersaoCte) {
    await repositorioFocusNfe.atualizarUltimaVersaoCte(companyId, max)
    credenciais.ultimaVersaoCte = max
  }
  return max
}

const LIMITE_LOTE_SYNC = 10

type ResultadoXml = {
  ok: boolean
  rateLimit: boolean
  ignorado?: boolean
  mensagem?: string
}

async function executarSync(companyId: string, jobId: string) {
  const linhasLog: string[] = []
  const pushLog = (msg: string) => {
    linhasLog.push(msg)
    if (linhasLog.length > 40) linhasLog.shift()
  }

  try {
    await repositorioFocusNfe.atualizarJob(jobId, {
      status: 'rodando',
      iniciadoEm: new Date(),
      progresso: 5,
      mensagem: 'Iniciando sincronização em lote…',
    })
    logFocus('info', 'job_inicio', { id: jobId, tipo: 'sync', companyId })

    const jobAtual = await repositorioFocusNfe.buscarJob(jobId, companyId)
    const payloadJob = (jobAtual?.payloadJson ?? {}) as {
      completo?: boolean
      liberarExtras?: boolean
    }
    const liberarExtras = payloadJob.liberarExtras === true
    const configCota = lerConfigCotaFocus()
    const cotaHabilitada = configCota.habilitada
    const cotaMensal = configCota.cota
    let usadosNoMes = cotaHabilitada ? await contarUsoMesFocus(companyId) : 0
    let cotaEsgotadaNoLote = false

    const credenciais = await obterCredenciais(companyId)
    const empresa = await repositorioFocusNfe.buscarEmpresaCnpj(companyId)
    if (!empresa?.cnpj) {
      throw new ErroDaAplicacao('Empresa sem CNPJ cadastrado — necessário para NFe recebidas.', 400)
    }

    const cnpj = normalizarCnpj(empresa.cnpj)
    const cnpjMascarado = mascararCnpj(cnpj)
    const ambiente = credenciais.homologacao ? 'homolog' : 'producao'
    const temConfigBanco = !!(await repositorioFocusNfe.buscarConfigPorEmpresa(companyId))

    logFocus('info', 'sync_credenciais', {
      companyId,
      fonte: credenciais.fonte,
      homologacao: credenciais.homologacao,
      cnpj: cnpjMascarado,
    })
    pushLog(
      `fonte=${credenciais.fonte} ambiente=${ambiente} cnpj=${cnpjMascarado} lote=${LIMITE_LOTE_SYNC}` +
        (cotaHabilitada
          ? ` cota=${usadosNoMes}/${cotaMensal}${liberarExtras ? ' extras=sim' : ''}`
          : ' cota=off')
    )

    let processados = 0
    let novas = 0
    let atualizadas = 0
    let novasNfse = 0
    let atualizadasNfse = 0
    let novasCte = 0
    let atualizadasCte = 0
    let rateLimit = false
    let versao = credenciais.ultimaVersao
    let maxVersao = versao
    let versaoNfse = credenciais.ultimaVersaoNfse
    let maxVersaoNfse = versaoNfse
    let versaoCte = credenciais.ultimaVersaoCte
    let maxVersaoCte = versaoCte
    /** Qtd devolvida pela Focus na página deste lote (diagnóstico DistDFe vazio). */
    let qtdNfePagina = 0
    let qtdNfsePagina = 0
    let qtdCtePagina = 0
    let nfeListadaOk = false
    let nfseListadaOk = false
    let cteListadaOk = false

    /** Retorna false se a cota bloqueia criar uma nota nova (pausa o lote). */
    const podeCriarNotaNova = (): boolean => {
      if (!cotaHabilitada || liberarExtras) return true
      if (usadosNoMes < cotaMensal) return true
      cotaEsgotadaNoLote = true
      return false
    }

    // --- NFe 55 ---
    if (processados < LIMITE_LOTE_SYNC && !rateLimit && !cotaEsgotadaNoLote) {
      const resp = await clienteFocusNfe.listarNfesRecebidas(
        credenciais.apiToken,
        credenciais.homologacao,
        cnpj,
        versao > 0 ? versao : undefined
      )

      if (!resp.sucesso) {
        if (resp.codigoHttp === 429) {
          rateLimit = true
          pushLog(`nfe lista: rate limit — ${resp.mensagem}`)
        } else {
          const mensagem = mensagemErroFocusAmigavel({
            codigoHttp: resp.codigoHttp,
            mensagemOriginal: resp.mensagem,
            ambiente,
            cnpjMascarado,
            fonte: credenciais.fonte,
          })
          throw new ErroDaAplicacao(mensagem, resp.codigoHttp ?? 502)
        }
      } else {
        const lista = Array.isArray(resp.dados) ? resp.dados : []
        const headerMax = resp.headers['x-max-version']
        const maxDaPagina = headerMax ? Number(headerMax) : 0
        nfeListadaOk = true
        qtdNfePagina = lista.length

        logFocus('info', 'sync_pagina', {
          companyId,
          versaoDe: versao,
          qtd: lista.length,
          maxVersao: maxDaPagina || '',
          cnpj: cnpjMascarado,
          limite: LIMITE_LOTE_SYNC,
        })
        pushLog(`nfe página: ${lista.length} (versão≥${versao}, processar até ${LIMITE_LOTE_SYNC})`)

        if (lista.length === 0) {
          logFocus('warn', 'sync_nfe_vazia', {
            companyId,
            cnpj: cnpjMascarado,
            versaoDe: versao,
            ambiente,
          })
          pushLog('nfe: Focus devolveu 0 documentos (DistDFe vazio neste cursor)')
        }

        for (const item of lista) {
          if (processados >= LIMITE_LOTE_SYNC || rateLimit || cotaEsgotadaNoLote) break
          const versaoItem = item.versao ?? 0
          if (!item.chave_nfe) {
            // Avança cursor mesmo sem chave — senão o DistDFe trava no mesmo NSU.
            if (versaoItem > maxVersao) maxVersao = versaoItem
            if (temConfigBanco && maxVersao > credenciais.ultimaVersao) {
              await repositorioFocusNfe.atualizarUltimaVersao(companyId, maxVersao)
              credenciais.ultimaVersao = maxVersao
            }
            continue
          }

          const mapeado = mapearResumo(item)
          const existentePre = await repositorioFocusNfe.buscarPorChave(companyId, mapeado.chaveNfe)
          if (!existentePre && !podeCriarNotaNova()) {
            pushLog(`nfe: cota mensal esgotada (${usadosNoMes}/${cotaMensal}) — pausando lote`)
            break
          }
          if (
            existentePre?.nfeCompleta &&
            existentePre.xmlConteudo &&
            xmlNfeTemItensParseaveis(existentePre.xmlConteudo)
          ) {
            // Nota já tem XML completo — não rebaixa da Focus, mas repara itens
            // caso um pipeline anterior tenha falhado antes de gravá-los.
            await servicoEntradaNotas.sincronizarItensPendentesDoXml(companyId, existentePre.id)
            if (mapeado.versaoFocus > maxVersao) maxVersao = mapeado.versaoFocus
            if (temConfigBanco && maxVersao > credenciais.ultimaVersao) {
              await repositorioFocusNfe.atualizarUltimaVersao(companyId, maxVersao)
              credenciais.ultimaVersao = maxVersao
            }
            atualizadas += 1
            processados += 1
            await repositorioFocusNfe.atualizarJob(jobId, {
              progresso: Math.min(85, 10 + processados * 7),
              mensagem: `Lote: ${processados}/${LIMITE_LOTE_SYNC} — NFe +${novas}/~${atualizadas}`,
              logResumo: linhasLog.join('\n'),
            })
            continue
          }

          const { criado } = await repositorioFocusNfe.upsertNfeRecebida({
            companyId,
            ...mapeado,
            origem: 'focus',
          })
          if (criado) {
            novas += 1
            usadosNoMes += 1
          } else {
            atualizadas += 1
          }
          if (mapeado.versaoFocus > maxVersao) maxVersao = mapeado.versaoFocus

          if (temConfigBanco && maxVersao > credenciais.ultimaVersao) {
            await repositorioFocusNfe.atualizarUltimaVersao(companyId, maxVersao)
            credenciais.ultimaVersao = maxVersao
          }

          const xmlRes = await completarXmlDaFocus(
            companyId,
            credenciais.apiToken,
            credenciais.homologacao,
            item,
            pushLog
          )
          if (xmlRes.rateLimit) {
            rateLimit = true
            pushLog('nfe: lote pausado por rate limit Focus')
            break
          }

          processados += 1
          await repositorioFocusNfe.atualizarJob(jobId, {
            progresso: Math.min(85, 10 + processados * 7),
            mensagem: `Lote: ${processados}/${LIMITE_LOTE_SYNC} — NFe +${novas}/~${atualizadas}`,
            logResumo: linhasLog.join('\n'),
          })
        }

        // Nunca usar x-max-version para avançar cursor: a Focus pagina ~100 e o lote
        // processa só LIMITE_LOTE_SYNC — pular para o header descartava NFes do meio.
        if (temConfigBanco && maxVersao > credenciais.ultimaVersao) {
          await repositorioFocusNfe.atualizarUltimaVersao(companyId, maxVersao)
          credenciais.ultimaVersao = maxVersao
        }
      }
    }

    // --- NFS-e nacional ---
    if (processados < LIMITE_LOTE_SYNC && !rateLimit && !cotaEsgotadaNoLote) {
      const respNfse = await clienteFocusNfe.listarNfsesRecebidas(
        credenciais.apiToken,
        credenciais.homologacao,
        cnpj,
        versaoNfse > 0 ? versaoNfse : undefined
      )

      if (!respNfse.sucesso) {
        if (respNfse.codigoHttp === 429) {
          rateLimit = true
          pushLog(`nfse lista: rate limit — ${respNfse.mensagem}`)
        } else {
          pushLog(`nfse: ${respNfse.mensagem}`)
          logFocus('warn', 'sync_nfse_falhou', {
            companyId,
            http: respNfse.codigoHttp ?? '',
            mensagem: respNfse.mensagem,
          })
        }
      } else {
        const listaNfse = Array.isArray(respNfse.dados) ? respNfse.dados : []
        const headerMaxNfse = respNfse.headers['x-max-version']
        const maxDaPaginaNfse = headerMaxNfse ? Number(headerMaxNfse) : 0
        nfseListadaOk = true
        qtdNfsePagina = listaNfse.length

        logFocus('info', 'sync_pagina_nfse', {
          companyId,
          versaoDe: versaoNfse,
          qtd: listaNfse.length,
          maxVersao: maxDaPaginaNfse || '',
          cnpj: cnpjMascarado,
          limite: LIMITE_LOTE_SYNC,
        })
        pushLog(
          `nfse página: ${listaNfse.length} (versão≥${versaoNfse}, resto lote ${LIMITE_LOTE_SYNC - processados})`
        )

        for (const item of listaNfse) {
          if (processados >= LIMITE_LOTE_SYNC || rateLimit || cotaEsgotadaNoLote) break
          const versaoItem = item.versao ?? 0
          const chave = chaveNfseFocus(item)
          if (!chave) {
            if (versaoItem > maxVersaoNfse) maxVersaoNfse = versaoItem
            if (temConfigBanco && maxVersaoNfse > credenciais.ultimaVersaoNfse) {
              await repositorioFocusNfe.atualizarUltimaVersaoNfse(companyId, maxVersaoNfse)
              credenciais.ultimaVersaoNfse = maxVersaoNfse
            }
            continue
          }

          const mapeado = mapearResumoNfse(item)
          const existentePre = await repositorioFocusNfe.buscarPorChave(companyId, mapeado.chaveNfe)
          if (!existentePre && !podeCriarNotaNova()) {
            pushLog(`nfse: cota mensal esgotada (${usadosNoMes}/${cotaMensal}) — pausando lote`)
            break
          }
          if (existentePre?.nfeCompleta && existentePre.xmlConteudo) {
            if (mapeado.versaoFocus > maxVersaoNfse) maxVersaoNfse = mapeado.versaoFocus
            if (temConfigBanco && maxVersaoNfse > credenciais.ultimaVersaoNfse) {
              await repositorioFocusNfe.atualizarUltimaVersaoNfse(companyId, maxVersaoNfse)
              credenciais.ultimaVersaoNfse = maxVersaoNfse
            }
            atualizadasNfse += 1
            processados += 1
            await repositorioFocusNfe.atualizarJob(jobId, {
              progresso: Math.min(95, 40 + processados * 5),
              mensagem: `Lote: ${processados}/${LIMITE_LOTE_SYNC} — NFS-e +${novasNfse}/~${atualizadasNfse}`,
              logResumo: linhasLog.join('\n'),
            })
            continue
          }

          const { criado, registro } = await repositorioFocusNfe.upsertNfeRecebida({
            companyId,
            ...mapeado,
            origem: 'focus',
          })
          if (criado) {
            novasNfse += 1
            usadosNoMes += 1
          } else {
            atualizadasNfse += 1
          }
          if (mapeado.versaoFocus > maxVersaoNfse) maxVersaoNfse = mapeado.versaoFocus

          if (temConfigBanco && maxVersaoNfse > credenciais.ultimaVersaoNfse) {
            await repositorioFocusNfe.atualizarUltimaVersaoNfse(companyId, maxVersaoNfse)
            credenciais.ultimaVersaoNfse = maxVersaoNfse
          }

          const xmlRes = await completarXmlNfseDaFocus(
            companyId,
            credenciais.apiToken,
            credenciais.homologacao,
            chave,
            registro.id,
            pushLog
          )
          if (xmlRes.rateLimit) {
            rateLimit = true
            pushLog('nfse: lote pausado por rate limit Focus')
            break
          }

          processados += 1
          await repositorioFocusNfe.atualizarJob(jobId, {
            progresso: Math.min(95, 40 + processados * 5),
            mensagem: `Lote: ${processados}/${LIMITE_LOTE_SYNC} — NFS-e +${novasNfse}/~${atualizadasNfse}`,
            logResumo: linhasLog.join('\n'),
          })
        }

        // Não avançar com x-max-version (mesmo motivo do sync NFe).
        if (temConfigBanco && maxVersaoNfse > credenciais.ultimaVersaoNfse) {
          await repositorioFocusNfe.atualizarUltimaVersaoNfse(companyId, maxVersaoNfse)
          credenciais.ultimaVersaoNfse = maxVersaoNfse
        }
      }
    }

    // --- CTe ---
    if (processados < LIMITE_LOTE_SYNC && !rateLimit && !cotaEsgotadaNoLote) {
      const respCte = await clienteFocusNfe.listarCtesRecebidas(
        credenciais.apiToken,
        credenciais.homologacao,
        cnpj,
        versaoCte > 0 ? versaoCte : undefined
      )

      if (!respCte.sucesso) {
        if (respCte.codigoHttp === 429) {
          rateLimit = true
          pushLog(`cte lista: rate limit — ${respCte.mensagem}`)
        } else {
          pushLog(`cte: ${respCte.mensagem}`)
          logFocus('warn', 'sync_cte_falhou', {
            companyId,
            http: respCte.codigoHttp ?? '',
            mensagem: respCte.mensagem,
          })
        }
      } else {
        const listaCte = Array.isArray(respCte.dados) ? respCte.dados : []
        const headerMaxCte = respCte.headers['x-max-version']
        const maxDaPaginaCte = headerMaxCte ? Number(headerMaxCte) : 0
        cteListadaOk = true
        qtdCtePagina = listaCte.length

        logFocus('info', 'sync_pagina_cte', {
          companyId,
          versaoDe: versaoCte,
          qtd: listaCte.length,
          maxVersao: maxDaPaginaCte || '',
          cnpj: cnpjMascarado,
          limite: LIMITE_LOTE_SYNC,
        })
        pushLog(
          `cte página: ${listaCte.length} (versão≥${versaoCte}, resto lote ${LIMITE_LOTE_SYNC - processados})`
        )

        if (listaCte.length === 0) {
          logFocus('warn', 'sync_cte_vazia', {
            companyId,
            cnpj: cnpjMascarado,
            versaoDe: versaoCte,
            ambiente,
          })
          pushLog('cte: Focus devolveu 0 documentos neste cursor')
        }


        for (const item of listaCte) {
          if (processados >= LIMITE_LOTE_SYNC || rateLimit || cotaEsgotadaNoLote) break
          const versaoItem = item.versao ?? 0
          const chave = chaveCteFocus(item)
          if (!chave) {
            maxVersaoCte = await avancarCursorCte(
              companyId,
              credenciais,
              temConfigBanco,
              maxVersaoCte,
              versaoItem
            )
            continue
          }

          const somosTomadorResumo = compararTomadorComEmpresa(tomadorDoResumoCte(item), cnpj)
          if (somosTomadorResumo === false) {
            pushLog(`cte ignorado: nao somos tomador ${chave.slice(-8)}`)
            logFocus('info', 'sync_cte_ignorado_nao_tomador', {
              companyId,
              chave: chave.slice(-8),
              fonte: 'resumo',
            })
            maxVersaoCte = await avancarCursorCte(
              companyId,
              credenciais,
              temConfigBanco,
              maxVersaoCte,
              versaoItem
            )
            // Não conta no lote nem baixa XML (resumo já diz que não somos tomador).
            continue
          }

          // Tomador desconhecido no resumo: baixa XML só para decidir (fail-closed).
          if (somosTomadorResumo === null) {
            const existente = await repositorioFocusNfe.buscarPorChave(companyId, chave)
            if (existente?.xmlConteudo && existente.nfeCompleta) {
              const tomadorXml = extrairCnpjTomadorCte(existente.xmlConteudo)
              if (compararTomadorComEmpresa(tomadorXml, cnpj) !== true) {
                pushLog(`cte ignorado: nao somos tomador ${chave.slice(-8)}`)
                logFocus('info', 'sync_cte_ignorado_nao_tomador', {
                  companyId,
                  chave: chave.slice(-8),
                  fonte: 'xml_local',
                })
                maxVersaoCte = await avancarCursorCte(
                  companyId,
                  credenciais,
                  temConfigBanco,
                  maxVersaoCte,
                  versaoItem
                )
                continue
              }
              maxVersaoCte = await avancarCursorCte(
                companyId,
                credenciais,
                temConfigBanco,
                maxVersaoCte,
                versaoItem
              )
              processados += 1
              continue
            }

            if (!existente && !podeCriarNotaNova()) {
              pushLog(`cte: cota mensal esgotada (${usadosNoMes}/${cotaMensal}) — pausando lote`)
              break
            }

            const xmlResp = await clienteFocusNfe.baixarXmlCte(
              credenciais.apiToken,
              credenciais.homologacao,
              chave
            )
            if (!xmlResp.sucesso || typeof xmlResp.dados !== 'string') {
              if (xmlResp.sucesso === false && xmlResp.codigoHttp === 429) {
                rateLimit = true
                pushLog('cte: lote pausado por rate limit Focus')
                break
              }
              pushLog(
                `xml cte ${chave.slice(-8)}: ${xmlResp.sucesso === false ? xmlResp.mensagem : 'vazio'}`
              )
              maxVersaoCte = await avancarCursorCte(
                companyId,
                credenciais,
                temConfigBanco,
                maxVersaoCte,
                versaoItem
              )
              processados += 1
              continue
            }

            const tomadorXml = extrairCnpjTomadorCte(xmlResp.dados)
            if (compararTomadorComEmpresa(tomadorXml, cnpj) !== true) {
              pushLog(`cte ignorado: nao somos tomador ${chave.slice(-8)}`)
              logFocus('info', 'sync_cte_ignorado_nao_tomador', {
                companyId,
                chave: chave.slice(-8),
                fonte: 'xml',
              })
              maxVersaoCte = await avancarCursorCte(
                companyId,
                credenciais,
                temConfigBanco,
                maxVersaoCte,
                versaoItem
              )
              processados += 1
              continue
            }

            if (!existente && !podeCriarNotaNova()) {
              pushLog(`cte: cota mensal esgotada (${usadosNoMes}/${cotaMensal}) — pausando lote`)
              break
            }

            const campos = extrairCamposResumoDoXml(xmlResp.dados)
            const { criado, registro } = await repositorioFocusNfe.upsertNfeRecebida({
              companyId,
              chaveNfe: chave,
              tipoDocumento: 'cte',
              nomeEmitente: campos.nomeEmitente,
              documentoEmitente: campos.documentoEmitente,
              cnpjDestinatario: campos.cnpjDestinatario,
              dataEmissao: campos.dataEmissao,
              valorTotal: campos.valorTotal,
              xmlConteudo: xmlResp.dados,
              nfeCompleta: true,
              origem: 'focus',
              situacao: item.status ?? item.situacao ?? 'autorizada',
              versaoFocus: versaoItem,
              etapaAtual: 'servico',
            })
            if (criado) {
              novasCte += 1
              usadosNoMes += 1
            } else {
              atualizadasCte += 1
            }
            maxVersaoCte = await avancarCursorCte(
              companyId,
              credenciais,
              temConfigBanco,
              maxVersaoCte,
              versaoItem
            )
            await servicoEntradaNotas.processarAposXml(companyId, registro.id)
            processados += 1
            await repositorioFocusNfe.atualizarJob(jobId, {
              progresso: Math.min(95, 50 + processados * 4),
              mensagem: `Lote: ${processados}/${LIMITE_LOTE_SYNC} — CTe +${novasCte}/~${atualizadasCte}`,
              logResumo: linhasLog.join('\n'),
            })
            continue
          }

          // Resumo já confirma que somos tomador.
          const mapeado = mapearResumoCte(item)
          const existentePre = await repositorioFocusNfe.buscarPorChave(companyId, mapeado.chaveNfe)
          if (!existentePre && !podeCriarNotaNova()) {
            pushLog(`cte: cota mensal esgotada (${usadosNoMes}/${cotaMensal}) — pausando lote`)
            break
          }
          if (existentePre?.nfeCompleta && existentePre.xmlConteudo) {
            maxVersaoCte = await avancarCursorCte(
              companyId,
              credenciais,
              temConfigBanco,
              maxVersaoCte,
              mapeado.versaoFocus
            )
            atualizadasCte += 1
            processados += 1
            continue
          }

          const { criado, registro } = await repositorioFocusNfe.upsertNfeRecebida({
            companyId,
            ...mapeado,
            origem: 'focus',
          })
          if (criado) {
            novasCte += 1
            usadosNoMes += 1
          } else {
            atualizadasCte += 1
          }
          maxVersaoCte = await avancarCursorCte(
            companyId,
            credenciais,
            temConfigBanco,
            maxVersaoCte,
            mapeado.versaoFocus
          )

          const xmlRes = await completarXmlCteDaFocus(
            companyId,
            credenciais.apiToken,
            credenciais.homologacao,
            chave,
            registro.id,
            cnpj,
            pushLog
          )
          if (xmlRes.rateLimit) {
            rateLimit = true
            pushLog('cte: lote pausado por rate limit Focus')
            break
          }
          if (xmlRes.ignorado) {
            pushLog(`cte ignorado: nao somos tomador ${chave.slice(-8)}`)
          }

          processados += 1
          await repositorioFocusNfe.atualizarJob(jobId, {
            progresso: Math.min(95, 50 + processados * 4),
            mensagem: `Lote: ${processados}/${LIMITE_LOTE_SYNC} — CTe +${novasCte}/~${atualizadasCte}`,
            logResumo: linhasLog.join('\n'),
          })
        }

        // Não avançar com x-max-version (mesmo motivo do sync NFe).
        if (temConfigBanco && maxVersaoCte > credenciais.ultimaVersaoCte) {
          await repositorioFocusNfe.atualizarUltimaVersaoCte(companyId, maxVersaoCte)
          credenciais.ultimaVersaoCte = maxVersaoCte
        }
      }
    }

    logFocus('info', 'sync_persistidas', {
      companyId,
      novas,
      atualizadas,
      novasNfse,
      atualizadasNfse,
      novasCte,
      atualizadasCte,
      qtdNfePagina,
      qtdNfsePagina,
      qtdCtePagina,
      processados,
      rateLimit,
    })
    pushLog(
      `fim lote: processados=${processados} nfe +${novas}/~${atualizadas}; nfse +${novasNfse}/~${atualizadasNfse}; cte +${novasCte}/~${atualizadasCte}${
        rateLimit ? ' (rate limit)' : ''
      }`
    )

    const totalNovas = novas + novasNfse + novasCte
    const totalAtualizadas = atualizadas + atualizadasNfse + atualizadasCte
    const nfeVaziaComOutros =
      nfeListadaOk &&
      qtdNfePagina === 0 &&
      (qtdNfsePagina > 0 ||
        qtdCtePagina > 0 ||
        novasNfse + atualizadasNfse + novasCte + atualizadasCte > 0)
    const cteVaziaComOutros =
      cteListadaOk &&
      qtdCtePagina === 0 &&
      (qtdNfePagina > 0 ||
        qtdNfsePagina > 0 ||
        novas + atualizadas + novasNfse + atualizadasNfse > 0)

    let mensagemFim: string
    if (cotaEsgotadaNoLote) {
      mensagemFim =
        `Cota mensal Focus esgotada (${usadosNoMes}/${cotaMensal}). ` +
        `Lote pausado após ${processados} nota(s) (NFe +${novas}; NFS-e +${novasNfse}; CTe +${novasCte}). ` +
        'Use BUSCAR e confirme a liberação de extras para continuar.'
    } else if (rateLimit) {
      mensagemFim = `Lote pausado por rate limit Focus após ${processados} nota(s). Já salvas no sistema; retoma no próximo ciclo (auto ~2 min).`
    } else if (nfeVaziaComOutros || cteVaziaComOutros) {
      const parteNfe =
        nfeListadaOk && qtdNfePagina === 0
          ? '0 NFe (DistDFe vazio)'
          : `NFe ${novas} novas / ${atualizadas} atualizadas`
      const parteNfse = `NFS-e ${novasNfse} novas / ${atualizadasNfse} atualizadas`
      const parteCte =
        cteListadaOk && qtdCtePagina === 0
          ? '0 CTe'
          : `CTe ${novasCte} novas / ${atualizadasCte} atualizadas`
      mensagemFim =
        `Sync: ${parteNfe} · ${parteNfse} · ${parteCte}. ` +
        'Confira Recebimento de NFes/CTe na Focus. Na lista use Ver todas (sem data).'
    } else if (processados >= LIMITE_LOTE_SYNC) {
      mensagemFim = `Lote de ${LIMITE_LOTE_SYNC} concluído (NFe +${novas}/~${atualizadas}; NFS-e +${novasNfse}/~${atualizadasNfse}; CTe +${novasCte}/~${atualizadasCte}). Próximas no sync automático.`
    } else if (totalNovas === 0 && totalAtualizadas === 0) {
      mensagemFim =
        'Sync OK, Focus sem novidades neste lote (0 NFe / 0 NFS-e / 0 CTe novas neste cursor). Lista e busca usam só o banco local. Use Ver todas (sem data) se o filtro esconder notas.'
    } else {
      mensagemFim = `Sync OK: NFe ${novas} novas / ${atualizadas} atualizadas; NFS-e ${novasNfse} novas / ${atualizadasNfse} atualizadas; CTe ${novasCte} novas / ${atualizadasCte} atualizadas.`
    }

    await repositorioFocusNfe.atualizarJob(jobId, {
      status: 'ok',
      progresso: 100,
      mensagem: mensagemFim,
      logResumo: linhasLog.join('\n'),
      finalizadoEm: new Date(),
    })
    logFocus('info', 'job_fim', { id: jobId, status: 'ok', companyId })
  } catch (erro) {
    const mensagem = erro instanceof ErroDaAplicacao ? erro.message : (erro as Error).message
    pushLog(`erro: ${mensagem}`)
    await repositorioFocusNfe.atualizarJob(jobId, {
      status: 'erro',
      mensagem,
      logResumo: linhasLog.join('\n'),
      finalizadoEm: new Date(),
    })
    logFocus('error', 'job_fim', { id: jobId, status: 'erro', companyId, mensagem })
  } finally {
    liberarTravaFocus(companyId)
  }
}

async function completarXmlNfseDaFocus(
  companyId: string,
  apiToken: string,
  homologacao: boolean,
  chave: string,
  registroId: string,
  pushLog: (msg: string) => void
): Promise<ResultadoXml> {
  const existente = await repositorioFocusNfe.buscarPorChave(companyId, chave)
  if (existente?.xmlConteudo && existente.nfeCompleta) {
    return { ok: true, rateLimit: false }
  }

  const xmlResp = await clienteFocusNfe.baixarXmlNfse(apiToken, homologacao, chave)
  if (!xmlResp.sucesso || typeof xmlResp.dados !== 'string') {
    const rateLimit = xmlResp.sucesso === false && xmlResp.codigoHttp === 429
    pushLog(`xml nfse ${chave.slice(-8)}: ${xmlResp.sucesso === false ? xmlResp.mensagem : 'vazio'}`)
    return { ok: false, rateLimit, mensagem: xmlResp.sucesso === false ? xmlResp.mensagem : 'vazio' }
  }

  const campos = extrairCamposResumoDoXml(xmlResp.dados)
  const { registro } = await repositorioFocusNfe.upsertNfeRecebida({
    companyId,
    chaveNfe: chave,
    tipoDocumento: 'nfse',
    nomeEmitente: campos.nomeEmitente,
    documentoEmitente: campos.documentoEmitente,
    cnpjDestinatario: campos.cnpjDestinatario,
    dataEmissao: campos.dataEmissao,
    valorTotal: campos.valorTotal,
    xmlConteudo: xmlResp.dados,
    nfeCompleta: true,
    origem: 'focus',
    situacao: existente?.situacao ?? 'autorizada',
    etapaAtual: 'servico',
  })
  await servicoEntradaNotas.processarAposXml(companyId, registro.id ?? registroId)
  return { ok: true, rateLimit: false }
}

async function completarXmlCteDaFocus(
  companyId: string,
  apiToken: string,
  homologacao: boolean,
  chave: string,
  registroId: string,
  cnpjEmpresa: string,
  pushLog: (msg: string) => void
): Promise<ResultadoXml> {
  const existente = await repositorioFocusNfe.buscarPorChave(companyId, chave)
  if (existente?.xmlConteudo && existente.nfeCompleta) {
    const tomador = extrairCnpjTomadorCte(existente.xmlConteudo)
    if (compararTomadorComEmpresa(tomador, cnpjEmpresa) !== true) {
      logFocus('info', 'sync_cte_ignorado_nao_tomador', {
        companyId,
        chave: chave.slice(-8),
        fonte: 'xml_local_completar',
      })
      return { ok: false, rateLimit: false, ignorado: true }
    }
    return { ok: true, rateLimit: false }
  }

  const xmlResp = await clienteFocusNfe.baixarXmlCte(apiToken, homologacao, chave)
  if (!xmlResp.sucesso || typeof xmlResp.dados !== 'string') {
    const rateLimit = xmlResp.sucesso === false && xmlResp.codigoHttp === 429
    pushLog(`xml cte ${chave.slice(-8)}: ${xmlResp.sucesso === false ? xmlResp.mensagem : 'vazio'}`)
    return { ok: false, rateLimit, mensagem: xmlResp.sucesso === false ? xmlResp.mensagem : 'vazio' }
  }

  const tomador = extrairCnpjTomadorCte(xmlResp.dados)
  if (compararTomadorComEmpresa(tomador, cnpjEmpresa) !== true) {
    logFocus('info', 'sync_cte_ignorado_nao_tomador', {
      companyId,
      chave: chave.slice(-8),
      fonte: 'xml_completar',
    })
    return { ok: false, rateLimit: false, ignorado: true }
  }

  const campos = extrairCamposResumoDoXml(xmlResp.dados)
  const { registro } = await repositorioFocusNfe.upsertNfeRecebida({
    companyId,
    chaveNfe: chave,
    tipoDocumento: 'cte',
    nomeEmitente: campos.nomeEmitente,
    documentoEmitente: campos.documentoEmitente,
    cnpjDestinatario: campos.cnpjDestinatario,
    dataEmissao: campos.dataEmissao,
    valorTotal: campos.valorTotal,
    xmlConteudo: xmlResp.dados,
    nfeCompleta: true,
    origem: 'focus',
    situacao: existente?.situacao ?? 'autorizada',
    etapaAtual: 'servico',
  })
  await servicoEntradaNotas.processarAposXml(companyId, registro.id ?? registroId)
  return { ok: true, rateLimit: false }
}

async function completarXmlDaFocus(
  companyId: string,
  apiToken: string,
  homologacao: boolean,
  item: NfeRecebidaResumoFocus,
  pushLog: (msg: string) => void
): Promise<ResultadoXml> {
  const chave = item.chave_nfe
  const existente = await repositorioFocusNfe.buscarPorChave(companyId, chave)
  if (
    existente?.xmlConteudo &&
    existente.nfeCompleta &&
    xmlNfeTemItensParseaveis(existente.xmlConteudo)
  ) {
    return { ok: true, rateLimit: false }
  }

  const man = (item.manifestacao_destinatario ?? '').toLowerCase()
  if (!man || man === 'nulo' || man === 'null') {
    const manResp = await clienteFocusNfe.manifestar(
      apiToken,
      homologacao,
      chave,
      'ciencia'
    )
    if (!manResp.sucesso) {
      pushLog(`ciência ${chave.slice(-8)}: ${manResp.mensagem}`)
      logFocus('warn', 'sync_ciencia_falhou', {
        companyId,
        chave: chave.slice(-8),
        mensagem: manResp.mensagem,
      })
      if (manResp.codigoHttp === 429) {
        return { ok: false, rateLimit: true, mensagem: manResp.mensagem }
      }
    }
  }

  const xmlResp = await clienteFocusNfe.baixarXml(apiToken, homologacao, chave)
  if (!xmlResp.sucesso || typeof xmlResp.dados !== 'string') {
    const rateLimit = xmlResp.sucesso === false && xmlResp.codigoHttp === 429
    pushLog(`xml ${chave.slice(-8)}: ${xmlResp.sucesso === false ? xmlResp.mensagem : 'vazio'}`)
    return { ok: false, rateLimit, mensagem: xmlResp.sucesso === false ? xmlResp.mensagem : 'vazio' }
  }

  const xmlCompleto = xmlNfeTemItensParseaveis(xmlResp.dados)
  if (!xmlCompleto) {
    pushLog(`xml ${chave.slice(-8)}: recebido resumo DistDFe (resNFe) — ainda sem itens`)
    logFocus('warn', 'sync_xml_resumo_sem_itens', {
      companyId,
      chave: chave.slice(-8),
      bytes: xmlResp.dados.length,
    })
  }

  const campos = extrairCamposResumoDoXml(xmlResp.dados)
  const { registro } = await repositorioFocusNfe.upsertNfeRecebida({
    companyId,
    chaveNfe: chave,
    nomeEmitente: campos.nomeEmitente,
    documentoEmitente: campos.documentoEmitente,
    cnpjDestinatario: campos.cnpjDestinatario,
    dataEmissao: campos.dataEmissao,
    valorTotal: campos.valorTotal,
    xmlConteudo: xmlResp.dados,
    nfeCompleta: xmlCompleto,
    origem: 'focus',
    situacao: item.situacao ?? 'autorizada',
    manifestacaoDestinatario: item.manifestacao_destinatario ?? 'ciencia',
  })
  await servicoEntradaNotas.processarAposXml(companyId, registro.id)
  return { ok: xmlCompleto, rateLimit: false }
}

async function enfileirarSync(
  companyId: string,
  opcoes?: { completo?: boolean; liberarExtras?: boolean }
) {
  if (!tentarTravarFocus(companyId)) {
    logFocus('warn', 'job_recusado_409', { companyId, motivo: 'ja_em_andamento' })
    throw new ErroDaAplicacao('Já existe uma sincronização Focus em andamento para esta empresa.', 409)
  }

  try {
    await obterCredenciais(companyId)
    const saldo = await saldoCotaFocus(companyId)
    if (saldo.habilitada && saldo.restantes <= 0 && !opcoes?.liberarExtras) {
      throw new ErroDaAplicacao(
        `Cota mensal de ${saldo.cota} notas Focus esgotada (${saldo.usados} usadas em ${saldo.mesReferencia}). Confirme a liberação de extras para continuar.`,
        402,
        {
          codigo: 'COTA_ESGOTADA',
          detalhes: {
            usados: saldo.usados,
            cota: saldo.cota,
            custoExtraCentavos: saldo.custoExtraCentavos,
            mesReferencia: saldo.mesReferencia,
          },
        }
      )
    }
  } catch (e) {
    liberarTravaFocus(companyId)
    throw e
  }

  if (opcoes?.completo) {
    await repositorioFocusNfe.resetarUltimaVersao(companyId)
    logFocus('info', 'sync_reset_versao', { companyId })
  }

  const job = await repositorioFocusNfe.criarJob({
    companyId,
    tipo: 'sync',
    payloadJson: {
      completo: opcoes?.completo === true,
      liberarExtras: opcoes?.liberarExtras === true,
    },
  })
  logFocus('info', 'job_criado', {
    id: job.id,
    tipo: 'sync',
    companyId,
    completo: !!opcoes?.completo,
    liberarExtras: !!opcoes?.liberarExtras,
  })

  setImmediate(() => {
    void executarSync(companyId, job.id)
  })

  return { jobId: job.id, status: job.status }
}

async function buscarCota(companyId: string) {
  return saldoCotaFocus(companyId)
}

async function statusJob(companyId: string, jobId: string) {
  const job = await repositorioFocusNfe.buscarJob(jobId, companyId)
  if (!job) throw new ErroDaAplicacao('Job não encontrado', 404)
  return {
    id: job.id,
    tipo: job.tipo,
    status: job.status,
    progresso: job.progresso,
    mensagem: job.mensagem,
    logResumo: job.logResumo,
    iniciadoEm: job.iniciadoEm,
    finalizadoEm: job.finalizadoEm,
  }
}

async function listarPendentes(
  companyId: string,
  filtros?: {
    dataDe?: string
    dataAte?: string
    painel?: 'analise' | 'contagem' | 'consolidada' | 'cancelada'
    busca?: string
  }
) {
  const painel = filtros?.painel ?? 'analise'
  const dataDe = filtros?.dataDe ? new Date(`${filtros.dataDe}T00:00:00`) : undefined
  const dataAte = filtros?.dataAte ? new Date(`${filtros.dataAte}T23:59:59.999`) : undefined
  const empresa = await repositorioFocusNfe.buscarEmpresaCnpj(companyId)
  const cnpjEmpresa = empresa?.cnpj ? normalizarCnpj(empresa.cnpj) : ''

  const notas = await repositorioFocusNfe.listarNfesPorPainel(companyId, {
    painel,
    dataDe: dataDe && !Number.isNaN(dataDe.getTime()) ? dataDe : undefined,
    dataAte: dataAte && !Number.isNaN(dataAte.getTime()) ? dataAte : undefined,
    busca: filtros?.busca,
  })
  return notas.map((n) => {
    const dest = n.cnpjDestinatario ? normalizarCnpj(n.cnpjDestinatario) : ''
    let destinatarioValidacao: 'ok' | 'divergente' | 'pendente' = 'pendente'
    if (dest && cnpjEmpresa) {
      destinatarioValidacao = dest === cnpjEmpresa ? 'ok' : 'divergente'
    }
    const count = (n as { _count?: { vinculosComoCte: number; vinculosComoNfe: number } })._count
    const temVinculoFrete =
      (count?.vinculosComoCte ?? 0) > 0 || (count?.vinculosComoNfe ?? 0) > 0
    return {
      id: n.id,
      chaveNfe: n.chaveNfe,
      tipoDocumento: n.tipoDocumento ?? 'nfe55',
      nomeEmitente: n.nomeEmitente,
      documentoEmitente: n.documentoEmitente,
      cnpjDestinatario: n.cnpjDestinatario,
      tipoNfe: n.tipoNfe,
      valorTotal: n.valorTotal != null ? Number(n.valorTotal) : null,
      dataEmissao: n.dataEmissao,
      situacao: n.situacao,
      manifestacaoDestinatario: n.manifestacaoDestinatario,
      nfeCompleta: n.nfeCompleta,
      statusEntrada: n.statusEntrada,
      origem: n.origem,
      etapaAtual: n.etapaAtual,
      origemLancamento: n.origemLancamento,
      criticasLiberadas: n.criticasLiberadas,
      /** Destinatário da NF confere com o CNPJ da empresa ativa? */
      destinatarioValidacao,
      cnpjEmpresa,
      temDanfe: Boolean(n.danfeCaminho && n.danfeStatus === 'ok'),
      danfeStatus: n.danfeStatus ?? null,
      /** CT-e↔NF já vinculados (frete). */
      temVinculoFrete,
      chaveNfeReferenciada: n.chaveNfeReferenciada ?? null,
    }
  })
}

/**
 * Obtém XML da nota: banco primeiro; se faltar, busca na Focus, salva e processa.
 * Inclui `visualizacao` legível (cabeçalho + itens) montada a partir do XML.
 * `modo`: visualizar exige flag verNota; download exige baixarXml.
 */
async function obterXmlNota(
  companyId: string,
  id: string,
  modo: 'visualizar' | 'download' = 'download'
) {
  const recursos = await obterRecursosEntradaNotas(companyId)
  if (modo === 'visualizar' && !recursos.verNota) {
    throw new ErroDaAplicacao(
      'Recurso Ver nota não disponível no plano da empresa.',
      403
    )
  }
  if (modo === 'download' && !recursos.baixarXml) {
    throw new ErroDaAplicacao(
      'Recurso Baixar XML não disponível no plano da empresa.',
      403
    )
  }

  const nota = await repositorioFocusNfe.buscarPorId(companyId, id)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada.', 404)

  let xml = nota.xmlConteudo
  let origemXml: 'banco' | 'focus' = 'banco'
  const precisaXmlCompleto =
    !xml ||
    ((nota.tipoDocumento === 'nfe55' || !nota.tipoDocumento) &&
      !xmlNfeTemItensParseaveis(xml))

  if (precisaXmlCompleto) {
    const credenciais = await obterCredenciais(companyId)
    const tipo = nota.tipoDocumento
    if (tipo !== 'nfse' && tipo !== 'cte') {
      const man = (nota.manifestacaoDestinatario ?? '').toLowerCase()
      if (!man || man === 'nulo' || man === 'null') {
        await clienteFocusNfe.manifestar(
          credenciais.apiToken,
          credenciais.homologacao,
          nota.chaveNfe,
          'ciencia'
        )
      }
    }
    const xmlResp =
      tipo === 'nfse'
        ? await clienteFocusNfe.baixarXmlNfse(
            credenciais.apiToken,
            credenciais.homologacao,
            nota.chaveNfe
          )
        : tipo === 'cte'
          ? await clienteFocusNfe.baixarXmlCte(
              credenciais.apiToken,
              credenciais.homologacao,
              nota.chaveNfe
            )
          : await clienteFocusNfe.baixarXml(
              credenciais.apiToken,
              credenciais.homologacao,
              nota.chaveNfe
            )

    if (!xmlResp.sucesso || typeof xmlResp.dados !== 'string') {
      const msg =
        xmlResp.sucesso === false
          ? xmlResp.mensagem
          : 'Focus devolveu XML vazio.'
      throw new ErroDaAplicacao(
        xmlResp.sucesso === false && xmlResp.codigoHttp === 429
          ? `Limite Focus excedido. Tente de novo em instantes. (${msg})`
          : `Não foi possível obter o XML: ${msg}`,
        xmlResp.sucesso === false ? (xmlResp.codigoHttp ?? 502) : 502
      )
    }

    xml = xmlResp.dados
    origemXml = 'focus'

    const campos = extrairCamposResumoDoXml(xml)
    const tipoPersistido =
      tipo === 'nfse' || tipo === 'cte' ? tipo : 'nfe55'
    const nfeCompleta =
      tipoPersistido !== 'nfe55' ? true : xmlNfeTemItensParseaveis(xml)
    await repositorioFocusNfe.upsertNfeRecebida({
      companyId,
      chaveNfe: nota.chaveNfe,
      tipoDocumento: tipoPersistido,
      nomeEmitente: campos.nomeEmitente ?? nota.nomeEmitente,
      documentoEmitente: campos.documentoEmitente ?? nota.documentoEmitente,
      cnpjDestinatario: campos.cnpjDestinatario ?? nota.cnpjDestinatario,
      dataEmissao: campos.dataEmissao ?? nota.dataEmissao,
      valorTotal: campos.valorTotal ?? (nota.valorTotal != null ? Number(nota.valorTotal) : null),
      xmlConteudo: xml,
      nfeCompleta,
      origem: 'focus',
    })
    await servicoEntradaNotas.processarAposXml(companyId, nota.id)
  } else {
    // XML já estava no banco — repara itens caso um pipeline anterior tenha
    // falhado antes de gravá-los, para o grid da nota não ficar dessincronizado
    // do que "Ver nota" mostra aqui.
    await servicoEntradaNotas.sincronizarItensPendentesDoXml(companyId, nota.id)
  }

  const atualizada = await repositorioFocusNfe.buscarPorId(companyId, id)
  const visualizacao = montarVisualizacaoDoXml(xml)

  // Prefere dados já persistidos quando o parser do XML vier incompleto
  if (!visualizacao.emitente.nome && (atualizada?.nomeEmitente || nota.nomeEmitente)) {
    visualizacao.emitente.nome = atualizada?.nomeEmitente ?? nota.nomeEmitente
  }
  if (!visualizacao.emitente.documento && (atualizada?.documentoEmitente || nota.documentoEmitente)) {
    visualizacao.emitente.documento = atualizada?.documentoEmitente ?? nota.documentoEmitente
  }
  if (!visualizacao.destinatario.documento && (atualizada?.cnpjDestinatario || nota.cnpjDestinatario)) {
    visualizacao.destinatario.documento = atualizada?.cnpjDestinatario ?? nota.cnpjDestinatario
  }
  if (visualizacao.valorTotal == null) {
    const v = atualizada?.valorTotal ?? nota.valorTotal
    visualizacao.valorTotal = v != null ? Number(v) : null
  }
  if (!visualizacao.dataEmissao && (atualizada?.dataEmissao || nota.dataEmissao)) {
    const d = atualizada?.dataEmissao ?? nota.dataEmissao
    visualizacao.dataEmissao = d ? d.toISOString() : null
  }
  if (!visualizacao.chaveNfe) visualizacao.chaveNfe = nota.chaveNfe
  if (
    visualizacao.tipoDocumento === 'desconhecido' &&
    (nota.tipoDocumento === 'nfse' || nota.tipoDocumento === 'cte')
  ) {
    visualizacao.tipoDocumento = nota.tipoDocumento
  }

  return {
    id: nota.id,
    chaveNfe: nota.chaveNfe,
    tipoDocumento: atualizada?.tipoDocumento ?? nota.tipoDocumento ?? 'nfe55',
    nomeEmitente: atualizada?.nomeEmitente ?? nota.nomeEmitente,
    documentoEmitente: atualizada?.documentoEmitente ?? nota.documentoEmitente,
    valorTotal:
      atualizada?.valorTotal != null
        ? Number(atualizada.valorTotal)
        : nota.valorTotal != null
          ? Number(nota.valorTotal)
          : null,
    dataEmissao: atualizada?.dataEmissao ?? nota.dataEmissao,
    xml,
    origemXml,
    visualizacao,
  }
}

/**
 * DANFE/DANFSe/DACTe (PDF): cache local primeiro; depois Focus (documento oficial).
 * NFe 55 + NFS-e nacional + CTe.
 */
async function obterDanfeNota(companyId: string, id: string) {
  const recursos = await obterRecursosEntradaNotas(companyId)
  if (!recursos.baixarPdfFocus) {
    throw new ErroDaAplicacao(
      'Recurso Baixar PDF não disponível no plano da empresa.',
      403
    )
  }

  const notaEncontrada = await repositorioFocusNfe.buscarPorId(companyId, id)
  if (!notaEncontrada) throw new ErroDaAplicacao('Nota não encontrada.', 404)
  const nota = notaEncontrada

  const tipo = nota.tipoDocumento
  const ehNfse = tipo === 'nfse'
  const ehCte = tipo === 'cte'
  const ehDocumental = ehNfse || ehCte
  const origemXml = (nota.origem ?? '').toLowerCase() === 'xml'
  const agora = Date.now()
  const atualizadoEm = nota.danfeAtualizadoEm?.getTime() ?? 0
  const dentroCacheIndisponivel =
    agora - atualizadoEm < recursos.danfeCacheIndisponivelHoras * 60 * 60 * 1000
  const dentroRateLimit =
    agora - atualizadoEm < recursos.danfeRateLimitMinutos * 60 * 1000

  async function persistirPdfLocal(pdf: Buffer, origem: 'cache' | 'focus') {
    const caminho = await salvarDanfe(companyId, nota.id, pdf)
    await repositorioFocusNfe.atualizarDanfe(nota.id, {
      danfeCaminho: caminho,
      danfeStatus: 'ok',
      danfeAtualizadoEm: new Date(),
    })
    return {
      id: nota.id,
      chaveNfe: nota.chaveNfe,
      tipoDocumento: nota.tipoDocumento,
      pdf,
      origem,
    }
  }

  // 1) Cache em disco (somente DANFE/DACTe oficial — ignora PDF auxiliar legado)
  if (nota.danfeCaminho) {
    const local = await lerDanfePorCaminho(nota.danfeCaminho)
    if (local) {
      if (await detectarPdfAuxiliarLegado(local)) {
        logFocus('warn', 'danfe_cache_auxiliar_invalidado', {
          notaId: nota.id,
          chave: nota.chaveNfe,
        })
        await removerArquivoDanfe(nota.danfeCaminho)
        await repositorioFocusNfe.atualizarDanfe(nota.id, {
          danfeCaminho: null,
          danfeStatus: null,
          danfeAtualizadoEm: null,
        })
      } else {
        if (nota.danfeStatus !== 'ok') {
          await repositorioFocusNfe.atualizarDanfe(nota.id, {
            danfeStatus: 'ok',
            danfeAtualizadoEm: new Date(),
          })
        }
        return {
          id: nota.id,
          chaveNfe: nota.chaveNfe,
          tipoDocumento: nota.tipoDocumento,
          pdf: local,
          origem: 'cache' as const,
        }
      }
    }
  }

  // 2) Status recente: não martelar a Focus
  if (nota.danfeStatus === 'indisponivel' && dentroCacheIndisponivel) {
    throw new ErroDaAplicacao(
      origemXml
        ? 'DANFE ainda indisponível: esta nota foi importada por XML e não está no DistDFe da Focus. Use Ver nota.'
        : 'DANFE ainda indisponível na Focus para esta nota. Use Ver nota ou tente amanhã. (ciência/XML podem ser necessários)',
      422
    )
  }
  if (nota.danfeStatus === 'rate_limit' && dentroRateLimit) {
    throw new ErroDaAplicacao(
      `Limite da Focus excedido recentemente. Aguarde cerca de ${Math.max(1, recursos.danfeRateLimitMinutos)} minuto(s) e tente de novo.`,
      429
    )
  }

  const credenciais = await obterCredenciais(companyId)
  const empresa = await repositorioFocusNfe.buscarEmpresaCnpj(companyId)
  const cnpjEmpresa = empresa?.cnpj ? normalizarCnpj(empresa.cnpj) : null
  const chave = nota.chaveNfe

  // 3) NFe: garantir ciência + XML antes do PDF
  if (!ehDocumental && !(nota.xmlConteudo && nota.nfeCompleta)) {
    const man = (nota.manifestacaoDestinatario ?? '').toLowerCase()
    if (!man || man === 'nulo' || man === 'null') {
      await clienteFocusNfe.manifestar(
        credenciais.apiToken,
        credenciais.homologacao,
        chave,
        'ciencia',
        undefined,
        cnpjEmpresa
      )
    }
    const xmlRes = await completarXmlDaFocus(
      companyId,
      credenciais.apiToken,
      credenciais.homologacao,
      {
        chave_nfe: chave,
        manifestacao_destinatario: nota.manifestacaoDestinatario ?? 'ciencia',
        situacao: nota.situacao ?? undefined,
      },
      () => undefined
    )
    if (xmlRes.rateLimit) {
      await repositorioFocusNfe.atualizarDanfe(nota.id, {
        danfeStatus: 'rate_limit',
        danfeAtualizadoEm: new Date(),
      })
      throw new ErroDaAplicacao(
        'Limite Focus excedido ao preparar o XML. Aguarde um minuto e tente baixar o PDF de novo.',
        429
      )
    }
  }

  async function tentarPdf(): Promise<RespostaFocus<Buffer>> {
    if (ehNfse) {
      return clienteFocusNfe.baixarPdfNfse(
        credenciais.apiToken,
        credenciais.homologacao,
        chave,
        cnpjEmpresa
      )
    }
    if (ehCte) {
      return clienteFocusNfe.baixarPdfCte(
        credenciais.apiToken,
        credenciais.homologacao,
        chave,
        cnpjEmpresa
      )
    }
    return clienteFocusNfe.baixarPdfNfe(
      credenciais.apiToken,
      credenciais.homologacao,
      chave,
      cnpjEmpresa
    )
  }

  let pdfResp = await tentarPdf()

  // 4) 404: um retry após nova ciência/XML (NFe) — só se a Focus conhece o documento.
  // codigo nao_encontrado / origem XML: manifesto também falha (não martelar DistDFe).
  const focusNaoTemDocumento =
    (!pdfResp.sucesso && pdfResp.codigo === 'nao_encontrado') || origemXml
  if (
    !pdfResp.sucesso &&
    pdfResp.codigoHttp === 404 &&
    !ehDocumental &&
    !focusNaoTemDocumento
  ) {
    await clienteFocusNfe.manifestar(
      credenciais.apiToken,
      credenciais.homologacao,
      chave,
      'ciencia',
      undefined,
      cnpjEmpresa
    )
    await completarXmlDaFocus(
      companyId,
      credenciais.apiToken,
      credenciais.homologacao,
      {
        chave_nfe: chave,
        manifestacao_destinatario: 'ciencia',
        situacao: nota.situacao ?? undefined,
      },
      () => undefined
    )
    pdfResp = await tentarPdf()
  }

  if (!pdfResp.sucesso) {
    if (pdfResp.codigoHttp === 429) {
      await repositorioFocusNfe.atualizarDanfe(nota.id, {
        danfeStatus: 'rate_limit',
        danfeAtualizadoEm: new Date(),
      })
      throw new ErroDaAplicacao(
        'Limite Focus excedido. Aguarde cerca de 1 minuto e tente baixar o PDF de novo.',
        429
      )
    }
    if (pdfResp.codigoHttp === 404) {
      await repositorioFocusNfe.atualizarDanfe(nota.id, {
        danfeStatus: 'indisponivel',
        danfeAtualizadoEm: new Date(),
      })
      throw new ErroDaAplicacao(
        ehNfse
          ? 'PDF da NFS-e ainda não está disponível na Focus. Use Ver nota ou Baixar XML.'
          : ehCte
            ? 'DACTe ainda não está disponível na Focus. Use Ver nota ou Baixar XML.'
            : origemXml || pdfResp.codigo === 'nao_encontrado'
              ? 'Focus não encontrou esta NF no DistDFe (comum em notas importadas por XML). O DANFE só vem da Focus se a SEFAZ distribuir a nota. Use Ver nota.'
              : 'DANFE ainda não disponível na Focus (pode faltar ciência ou o PDF ainda não foi gerado). Use Ver nota.',
        422
      )
    }
    throw new ErroDaAplicacao(
      `Não foi possível baixar o PDF na Focus: ${pdfResp.mensagem}`,
      pdfResp.codigoHttp ?? 502
    )
  }

  return persistirPdfLocal(pdfResp.dados, 'focus')
}

async function buscarRecursosDocumento(companyId: string): Promise<RecursosEntradaNotas> {
  return obterRecursosEntradaNotas(companyId)
}

async function importarXml(companyId: string, xmlBruto: string) {
  const xml = normalizarXmlNfe(xmlBruto)
  const tipoDoc = detectarDocumentoFiscalXml(xml)
  if (tipoDoc === 'desconhecido') {
    logFocus('warn', 'import_xml_tipo_desconhecido', {
      companyId,
      bytes: xml.length,
      inicio: xml.slice(0, 80).replace(/\s+/g, ' '),
    })
    throw new ErroDaAplicacao(
      'XML não reconhecido. Envie XML de NFe modelo 55 (produto), NFS-e nacional (serviço) ou CTe (transporte) — não DANFE/DACTe PDF.',
      400
    )
  }

  const campos = extrairCamposResumoDoXml(xml)
  const chave = campos.chaveNfe
  if (!chave) {
    logFocus('warn', 'import_xml_sem_chave', {
      companyId,
      bytes: xml.length,
      inicio: xml.slice(0, 80).replace(/\s+/g, ' '),
    })
    throw new ErroDaAplicacao(
      tipoDoc === 'nfse'
        ? 'Não foi possível extrair a chave/Id da NFS-e do XML.'
        : tipoDoc === 'cte'
          ? 'Não foi possível extrair a chave (44 dígitos) do XML do CTe.'
          : 'Não foi possível extrair a chave (44 dígitos) do XML. Confirme que o arquivo é o XML da NF-e (não DANFE PDF nem evento).',
      400
    )
  }

  if (tipoDoc === 'cte') {
    const empresa = await repositorioFocusNfe.buscarEmpresaCnpj(companyId)
    if (!empresa?.cnpj) {
      throw new ErroDaAplicacao(
        'Empresa sem CNPJ cadastrado — necessário para validar tomador do CTe.',
        400
      )
    }
    const tomador = extrairCnpjTomadorCte(xml)
    if (compararTomadorComEmpresa(tomador, normalizarCnpj(empresa.cnpj)) !== true) {
      throw new ErroDaAplicacao(
        'CTe ignorado: empresa não é tomadora do frete. Só importe CTe em que o CNPJ da empresa seja o tomador do serviço.',
        400
      )
    }
  }

  const existente = await repositorioFocusNfe.buscarPorChave(companyId, chave)
  if (
    existente &&
    (existente.statusEntrada === 'entrada_contagem' ||
      existente.statusEntrada === 'entrada_consolidada')
  ) {
    throw new ErroDaAplicacao(
      `Documento ${chave} já teve entrada. Duplicidade bloqueada pela chave.`,
      409
    )
  }

  const tipoPersistido = tipoDoc
  const { registro, criado } = await repositorioFocusNfe.upsertNfeRecebida({
    companyId,
    chaveNfe: chave,
    tipoDocumento: tipoPersistido,
    nomeEmitente: campos.nomeEmitente,
    documentoEmitente: campos.documentoEmitente,
    cnpjDestinatario: campos.cnpjDestinatario,
    dataEmissao: campos.dataEmissao,
    valorTotal: campos.valorTotal,
    xmlConteudo: xml,
    nfeCompleta: true,
    origem: 'xml',
    situacao: existente?.situacao ?? 'autorizada',
    etapaAtual: tipoDoc === 'nfse' || tipoDoc === 'cte' ? 'servico' : 'cadastro',
    modFrete: campos.modFrete ?? null,
    chaveNfeReferenciada: campos.chaveNfeReferenciada ?? null,
  })

  logFocus('info', 'import_xml', {
    companyId,
    chave,
    criado,
    tipoDocumento: tipoDoc,
    bytes: xml.length,
    temData: !!campos.dataEmissao,
    temValor: campos.valorTotal != null,
  })

  await servicoEntradaNotas.processarAposXml(companyId, registro.id)
  const apos = await repositorioFocusNfe.buscarPorChave(companyId, chave)

  const mensagemContagem =
    tipoDoc === 'nfse'
      ? 'NFS-e importada e liberada para contagem documental (sem estoque).'
      : tipoDoc === 'cte'
        ? 'CTe importado e liberado para contagem documental (sem estoque).'
        : 'XML importado e entrada automática (Liberar para contagem) — sem críticas bloqueantes.'

  return {
    id: registro.id,
    chaveNfe: registro.chaveNfe,
    tipoDocumento: tipoPersistido,
    criado,
    statusEntrada: apos?.statusEntrada ?? registro.statusEntrada,
    etapaAtual: apos?.etapaAtual ?? registro.etapaAtual,
    mensagem:
      apos?.statusEntrada === 'entrada_contagem'
        ? mensagemContagem
        : criado
          ? 'XML importado. Abra a nota para concluir a análise de entrada.'
          : 'XML atualizado. Abra a nota para concluir a análise de entrada.',
  }
}

async function reprocessarXmlsLocais(companyId: string) {
  const lista = await repositorioFocusNfe.listarComXmlPendenteCampos(companyId)
  let ok = 0
  let itensRecuperados = 0
  for (const item of lista) {
    if (!item.xmlConteudo) continue
    const campos = extrairCamposResumoDoXml(item.xmlConteudo)
    await repositorioFocusNfe.upsertNfeRecebida({
      companyId,
      chaveNfe: item.chaveNfe,
      nomeEmitente: campos.nomeEmitente,
      documentoEmitente: campos.documentoEmitente,
      cnpjDestinatario: campos.cnpjDestinatario,
      dataEmissao: campos.dataEmissao,
      valorTotal: campos.valorTotal,
      xmlConteudo: item.xmlConteudo,
      nfeCompleta: xmlNfeTemItensParseaveis(item.xmlConteudo),
    })
    ok += 1
    const { itensAdicionados } = await servicoEntradaNotas.sincronizarItensPendentesDoXml(
      companyId,
      item.id
    )
    if (itensAdicionados > 0) itensRecuperados += 1
  }
  const vinculadas = await servicoEntradaNotas.vincularFornecedoresNasNotasPendentes(companyId)
  const vinculosCte = await servicoEntradaNotas.processarVinculosCtePendentes(companyId, {
    importarFocusSeAusente: true,
    forcarRetryFocus: true,
  })
  logFocus('info', 'reprocessar_xmls', {
    companyId,
    ok,
    itensRecuperados,
    vinculadas,
    ctesVinculados: vinculosCte.vinculados,
    ctesImportFocus: vinculosCte.importadosFocus,
  })
  return {
    processados: ok,
    itensRecuperados,
    vinculadas,
    ctesVinculados: vinculosCte.vinculados,
    ctesImportFocus: vinculosCte.importadosFocus,
    mensagem:
      vinculadas > 0 || vinculosCte.vinculados > 0
        ? `${ok} nota(s) reprocessada(s); ${vinculadas} fornecedor(es); ${vinculosCte.vinculados} CT-e(s) vinculado(s)${vinculosCte.importadosFocus > 0 ? ` (${vinculosCte.importadosFocus} NF via Focus)` : ''}.`
        : `${ok} nota(s) reprocessada(s) a partir do XML salvo (emitente, data, valor).`,
  }
}

async function previewAnaliseFiscal(companyId: string) {
  const config = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  const regras = sanitizarRegrasFiscais(
    (config?.regrasFiscaisJson as Partial<DadosRegrasFiscais> | null) ?? null
  )
  const resultado = analisarFiscalBasico(regras)
  logFocus('info', 'analise_fiscal', {
    companyId,
    status: resultado.status,
    ativo: regras?.ativo === true,
  })
  return resultado
}

export const servicoFocusNfe = {
  buscarConfig,
  salvarConfig,
  salvarRegrasFiscais,
  testarConexao,
  enfileirarSync,
  buscarCota,
  buscarRecursosDocumento,
  statusJob,
  listarPendentes,
  obterXmlNota,
  obterDanfeNota,
  importarXml,
  reprocessarXmlsLocais,
  previewAnaliseFiscal,
}

export { importarNfePorChave } from './importar-nfe-por-chave.js'
