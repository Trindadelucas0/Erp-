/**
 * Regras de negócio Focus NFe / Entrada de Notas (base).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { decodificarTextoXml } from '../../compartilhado/normalizacao/entidades-xml.js'
import { importarCtePorChave } from './importar-cte-por-chave.js'
import { clienteFocusNfe, type NfeRecebidaResumoFocus, type NfseRecebidaResumoFocus, type CteRecebidaResumoFocus, type RespostaFocus, type RespostaErro, ehErroTokenFocus, eh429BloqueioAutenticacaoFocus } from './cliente-focus-nfe.js'
import { registrarHandlerJob } from '../../compartilhado/jobs/registro-handlers-job.js'
import { servicoJobs } from '../../compartilhado/jobs/servico-jobs.js'
import type { ContextoJob } from '../../compartilhado/jobs/tipos-job.js'
import { logFocus } from './logs-focus-nfe.js'
import {
  mascararCnpj,
  mensagemBloqueioAutenticacaoFocus,
  mensagemErroFocusAmigavel,
  mensagemInconsistenciaFocusPdf,
  normalizarCnpj,
} from './mensagens-focus-nfe.js'
import { codigoHttpClienteErroFocus } from './codigo-http-cliente-focus.js'
import {
  extrairCamposResumoDoXml,
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
import { repositorioContagens } from '../contagens/repositorio-contagens.js'
import { lerConfigCotaFocus, saldoCotaFocus, contarUsoMesFocus } from './cota-focus-nfe.js'
import {
  obterRecursosEntradaNotas,
  type RecursosEntradaNotas,
} from './config-recursos-entrada-notas.js'
/** Tipo do job de sincronização Focus na fila (`Job.tipo`). */
const TIPO_JOB_FOCUS_SYNC = 'focus_sync'

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
    nomeEmitente: decodificarTextoXml(item.nome_emitente),
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
    nomeEmitente: decodificarTextoXml(item.nome_prestador),
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

/** Decisão de cursor DistDFe após tentativa de XML do CT-e (exportado para testes). */
export function decisaoAvancoCursorCteAposXml(res: ResultadoXml): 'avancar' | 'pausar' | 'retry' {
  if (res.rateLimit) return 'pausar'
  if (res.ok || res.ignorado) return 'avancar'
  return 'retry'
}

/**
 * Corpo do job `focus_sync`. Progresso, log e status ficam a cargo do worker
 * (`src/compartilhado/jobs/`) — aqui só a sincronização em lote.
 */
async function executarSync(companyId: string, contexto: ContextoJob) {
  const pushLog = (msg: string) => contexto.log(msg)

  try {
    await contexto.progresso(5, 'Iniciando sincronização em lote…')

    const payloadJob = contexto.payload as {
      completo?: boolean
      liberarExtras?: boolean
    }
    const liberarExtras = payloadJob.liberarExtras === true
    const configCota = lerConfigCotaFocus()
    const cotaHabilitada = configCota.habilitada
    const cotaMensal = configCota.cota
    let usadosNoMes = cotaHabilitada ? await contarUsoMesFocus(companyId) : 0
    let cotaEsgotadaNoLote = false

    // Reset do cursor dentro do job: garante que "sync completo" só zere a
    // versão quando o job realmente for executado (e não em um 409 de dedupe).
    if (payloadJob.completo === true) {
      await repositorioFocusNfe.resetarUltimaVersao(companyId)
      logFocus('info', 'sync_reset_versao', { companyId })
    }

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
          throw new ErroDaAplicacao(mensagem, codigoHttpClienteErroFocus(resp.codigoHttp))
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
            await contexto.progresso(
              Math.min(85, 10 + processados * 7),
              `Lote: ${processados}/${LIMITE_LOTE_SYNC} — NFe +${novas}/~${atualizadas}`
            )
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
          await contexto.progresso(
            Math.min(85, 10 + processados * 7),
            `Lote: ${processados}/${LIMITE_LOTE_SYNC} — NFe +${novas}/~${atualizadas}`
          )
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
            await contexto.progresso(
              Math.min(95, 40 + processados * 5),
              `Lote: ${processados}/${LIMITE_LOTE_SYNC} — NFS-e +${novasNfse}/~${atualizadasNfse}`
            )
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
          await contexto.progresso(
            Math.min(95, 40 + processados * 5),
            `Lote: ${processados}/${LIMITE_LOTE_SYNC} — NFS-e +${novasNfse}/~${atualizadasNfse}`
          )
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

          const existentePre = await repositorioFocusNfe.buscarPorChave(companyId, chave)
          if (existentePre?.nfeCompleta && existentePre.xmlConteudo) {
            maxVersaoCte = await avancarCursorCte(
              companyId,
              credenciais,
              temConfigBanco,
              maxVersaoCte,
              versaoItem
            )
            atualizadasCte += 1
            processados += 1
            continue
          }

          if (!existentePre && !podeCriarNotaNova()) {
            pushLog(`cte: cota mensal esgotada (${usadosNoMes}/${cotaMensal}) — pausando lote`)
            break
          }

          // Regra permanente: só grava CT-e se tomador = CNPJ da empresa.
          const importCte = await importarCtePorChave(companyId, chave, {
            apiToken: credenciais.apiToken,
            homologacao: credenciais.homologacao,
            versaoFocus: versaoItem,
            situacao: item.status ?? item.situacao ?? 'autorizada',
          })

          if (!importCte.ok) {
            if (importCte.motivo === 'rate_limit') {
              rateLimit = true
              pushLog('cte: lote pausado por rate limit Focus')
              break
            }
            if (importCte.motivo === 'tomador_nao_empresa') {
              pushLog(`cte ${chave.slice(-8)}: tomador ≠ empresa — skip + avanca cursor`)
              logFocus('info', 'sync_cte_tomador_nao_empresa_skip', {
                companyId,
                chave: chave.slice(-8),
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
            if (importCte.motivo === 'xml_falhou') {
              pushLog(`cte ${chave.slice(-8)}: ${importCte.mensagem} — sem avancar cursor`)
              logFocus('warn', 'sync_cte_xml_falhou_sem_avancar_cursor', {
                companyId,
                chave: chave.slice(-8),
                motivo: importCte.motivo,
                mensagem: importCte.mensagem,
              })
              break
            }
            pushLog(`cte ${chave.slice(-8)}: ${importCte.mensagem}`)
            break
          }

          if (importCte.criado) {
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
          processados += 1
          await contexto.progresso(
            Math.min(95, 50 + processados * 4),
            `Lote: ${processados}/${LIMITE_LOTE_SYNC} — CTe +${novasCte}/~${atualizadasCte}`
          )
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

    return { mensagem: mensagemFim }
  } catch (erro) {
    const mensagem = erro instanceof ErroDaAplicacao ? erro.message : (erro as Error).message
    pushLog(`erro: ${mensagem}`)
    logFocus('error', 'sync_falhou', { companyId, mensagem })
    throw erro
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
    modFrete: campos.modFrete ?? null,
  })
  await servicoEntradaNotas.processarAposXml(companyId, registro.id)
  return { ok: xmlCompleto, rateLimit: false }
}

/**
 * Valida credenciais e cota (erro imediato na tela) e coloca a sync na fila.
 * O dedupe por empresa é do banco: segunda chamada com job ativo devolve 409.
 */
async function enfileirarSync(
  companyId: string,
  opcoes?: { completo?: boolean; liberarExtras?: boolean }
) {
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

  try {
    const job = await servicoJobs.enfileirar({
      companyId,
      tipo: TIPO_JOB_FOCUS_SYNC,
      chaveDedupe: 'sync',
      payload: {
        completo: opcoes?.completo === true,
        liberarExtras: opcoes?.liberarExtras === true,
      },
      mensagemConflito: 'Já existe uma sincronização Focus em andamento para esta empresa.',
    })
    logFocus('info', 'job_criado', {
      id: job.jobId,
      tipo: TIPO_JOB_FOCUS_SYNC,
      companyId,
      completo: !!opcoes?.completo,
      liberarExtras: !!opcoes?.liberarExtras,
    })
    return job
  } catch (erro) {
    if (erro instanceof ErroDaAplicacao && erro.codigoHttp === 409) {
      logFocus('warn', 'job_recusado_409', { companyId, motivo: 'ja_em_andamento' })
    }
    throw erro
  }
}

async function syncEmAndamento(companyId: string) {
  return servicoJobs.existeJobAtivo(companyId, TIPO_JOB_FOCUS_SYNC)
}

async function buscarCota(companyId: string) {
  return saldoCotaFocus(companyId)
}

async function statusJob(companyId: string, jobId: string) {
  return servicoJobs.statusJob(companyId, jobId)
}

async function listarPendentes(
  companyId: string,
  filtros?: {
    dataDe?: string
    dataAte?: string
    painel?: 'analise' | 'aguardando_chegada' | 'contagem' | 'consolidada' | 'problemas' | 'cancelada'
    busca?: string
  }
) {
  const painel = filtros?.painel ?? 'analise'
  const dataDe = filtros?.dataDe ? new Date(`${filtros.dataDe}T00:00:00`) : undefined
  const dataAte = filtros?.dataAte ? new Date(`${filtros.dataAte}T23:59:59.999`) : undefined
  const dataDeOk = dataDe && !Number.isNaN(dataDe.getTime()) ? dataDe : undefined
  const dataAteOk = dataAte && !Number.isNaN(dataAte.getTime()) ? dataAte : undefined
  const empresa = await repositorioFocusNfe.buscarEmpresaCnpj(companyId)
  const cnpjEmpresa = empresa?.cnpj ? normalizarCnpj(empresa.cnpj) : ''

  const [notasBrutas, ctesForaDoFiltroData] = await Promise.all([
    repositorioFocusNfe.listarNfesPorPainel(companyId, {
      painel,
      dataDe: dataDeOk,
      dataAte: dataAteOk,
      busca: filtros?.busca,
    }),
    repositorioFocusNfe.contarCtesForaDoFiltroData(companyId, {
      painel,
      dataDe: dataDeOk,
      dataAte: dataAteOk,
    }),
  ])

  const idsNotas = notasBrutas.map((n) => n.id)
  const mapaBaixada =
    painel === 'contagem' || painel === 'consolidada'
      ? await repositorioContagens.mapaBaixadaPorNota(companyId, idsNotas)
      : new Map<string, boolean>()
  const mapaEmAndamento =
    painel === 'contagem'
      ? await repositorioContagens.mapaEmAndamentoPorNota(companyId, idsNotas)
      : new Map<string, boolean>()

  const notas = notasBrutas.map((n) => {
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
      nomeEmitente: decodificarTextoXml(n.nomeEmitente),
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
      auditoriaChegadaPendente: (() => {
        if (n.statusEntrada !== 'aguardando_chegada') return false
        const chegada = (n.analiseJson as { chegada?: { achados?: unknown[]; aceitoEm?: string | null } } | null)
          ?.chegada
        if (!chegada) return false
        const achados = Array.isArray(chegada.achados) ? chegada.achados.length : 0
        if (achados === 0) return false
        return !chegada.aceitoEm
      })(),
      contagemBaixada: mapaBaixada.get(n.id) === true,
      contagemEmAndamento: mapaEmAndamento.get(n.id) === true,
      divergenciaDesfecho: n.divergenciaDesfecho ?? null,
      /** ISO do desbloqueio (§7.17) — null = ainda retido no estoque. */
      divergenciaDesbloqueioEm: (() => {
        if (n.divergenciaDesfecho !== 'bloqueio') return null
        const gestao = (
          n.analiseJson as {
            divergenciaGestao?: { desbloqueioEm?: string }
          } | null
        )?.divergenciaGestao
        return gestao?.desbloqueioEm?.trim() || null
      })(),
    }
  })

  return { notas, ctesForaDoFiltroData }
}

/**
 * Obtém XML da nota: banco primeiro; se faltar, busca na Focus, salva e processa.
 * Inclui `visualizacao` legível (cabeçalho + itens) montada a partir do XML.
 * `modo`: visualizar exige flag verNota; download exige baixarXml.
 * Chamadas concorrentes para o mesmo id (ex.: Strict Mode / remount) compartilham uma Promise.
 */
const obterXmlEmVoo = new Map<string, Promise<Awaited<ReturnType<typeof obterXmlNotaInterno>>>>()

async function obterXmlNota(
  companyId: string,
  id: string,
  modo: 'visualizar' | 'download' = 'download'
) {
  const chave = `${companyId}:${id}:${modo}`
  const existente = obterXmlEmVoo.get(chave)
  if (existente) return existente
  const promessa = obterXmlNotaInterno(companyId, id, modo).finally(() => {
    if (obterXmlEmVoo.get(chave) === promessa) obterXmlEmVoo.delete(chave)
  })
  obterXmlEmVoo.set(chave, promessa)
  return promessa
}

async function obterXmlNotaInterno(
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
      const eh429 = xmlResp.sucesso === false && xmlResp.codigoHttp === 429
      if (eh429) {
        await repositorioFocusNfe.atualizarDanfe(nota.id, {
          danfeStatus: 'rate_limit',
          danfeAtualizadoEm: new Date(),
        })
      }
      throw new ErroDaAplicacao(
        eh429
          ? `Limite Focus excedido. Tente de novo em instantes. (${msg})`
          : `Não foi possível obter o XML: ${msg}`,
        eh429
          ? 429
          : codigoHttpClienteErroFocus(
              xmlResp.sucesso === false ? xmlResp.codigoHttp : undefined
            )
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
  if (!xml) throw new ErroDaAplicacao('XML da nota indisponível.', 502)
  const visualizacao = montarVisualizacaoDoXml(xml)

  // Prefere dados já persistidos quando o parser do XML vier incompleto
  if (!visualizacao.emitente.nome && (atualizada?.nomeEmitente || nota.nomeEmitente)) {
    visualizacao.emitente.nome = decodificarTextoXml(atualizada?.nomeEmitente ?? nota.nomeEmitente)
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
    nomeEmitente: decodificarTextoXml(atualizada?.nomeEmitente ?? nota.nomeEmitente),
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
type CredenciaisFocusObter = Awaited<ReturnType<typeof obterCredenciais>>

function lancarErroTokenOuBloqueioAuthFocus(
  resp: RespostaErro,
  credenciais: CredenciaisFocusObter,
  cnpjEmpresa: string | null
): void {
  if (eh429BloqueioAutenticacaoFocus(resp)) {
    throw new ErroDaAplicacao(mensagemBloqueioAutenticacaoFocus(resp.mensagem), 429)
  }
  if (ehErroTokenFocus(resp)) {
    const ambiente = credenciais.homologacao ? ('homolog' as const) : ('producao' as const)
    throw new ErroDaAplicacao(
      mensagemErroFocusAmigavel({
        codigoHttp: resp.codigoHttp,
        mensagemOriginal: resp.mensagem,
        ambiente,
        cnpjMascarado: cnpjEmpresa ? mascararCnpj(cnpjEmpresa) : undefined,
        fonte: credenciais.fonte,
      }),
      502
    )
  }
}

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

  // 3) NFe: ciência na Focus antes do PDF (mesmo com XML local) + XML completo se faltar
  if (!ehDocumental) {
    const man = (nota.manifestacaoDestinatario ?? '').toLowerCase()
    if (!man || man === 'nulo' || man === 'null') {
      const manResp = await clienteFocusNfe.manifestar(
        credenciais.apiToken,
        credenciais.homologacao,
        chave,
        'ciencia',
        undefined,
        cnpjEmpresa
      )
      if (!manResp.sucesso) {
        lancarErroTokenOuBloqueioAuthFocus(manResp, credenciais, cnpjEmpresa)
      }
    }
    if (!(nota.xmlConteudo && nota.nfeCompleta)) {
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
    const manResp404 = await clienteFocusNfe.manifestar(
      credenciais.apiToken,
      credenciais.homologacao,
      chave,
      'ciencia',
      undefined,
      cnpjEmpresa
    )
    if (!manResp404.sucesso) {
      lancarErroTokenOuBloqueioAuthFocus(manResp404, credenciais, cnpjEmpresa)
    }
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
    lancarErroTokenOuBloqueioAuthFocus(pdfResp, credenciais, cnpjEmpresa)

    const ambiente = credenciais.homologacao ? ('homolog' as const) : ('producao' as const)
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
    if (pdfResp.codigoHttp === 403) {
      if (!ehDocumental) {
        const manResp = await clienteFocusNfe.manifestar(
          credenciais.apiToken,
          credenciais.homologacao,
          chave,
          'ciencia',
          undefined,
          cnpjEmpresa
        )
        if (!manResp.sucesso) {
          lancarErroTokenOuBloqueioAuthFocus(manResp, credenciais, cnpjEmpresa)
        }
        pdfResp = await tentarPdf()
        if (pdfResp.sucesso) {
          return persistirPdfLocal(pdfResp.dados, 'focus')
        }
        lancarErroTokenOuBloqueioAuthFocus(pdfResp, credenciais, cnpjEmpresa)
      }

      const xmlFocusOk = ehNfse
        ? (
            await clienteFocusNfe.baixarXmlNfse(
              credenciais.apiToken,
              credenciais.homologacao,
              chave
            )
          ).sucesso
        : ehCte
          ? (
              await clienteFocusNfe.baixarXmlCte(
                credenciais.apiToken,
                credenciais.homologacao,
                chave
              )
            ).sucesso
          : (
              await clienteFocusNfe.baixarXml(
                credenciais.apiToken,
                credenciais.homologacao,
                chave,
                cnpjEmpresa
              )
            ).sucesso

      if (xmlFocusOk) {
        throw new ErroDaAplicacao(mensagemInconsistenciaFocusPdf(tipo), 422)
      }

      throw new ErroDaAplicacao(
        mensagemErroFocusAmigavel({
          codigoHttp: pdfResp.codigoHttp,
          mensagemOriginal: pdfResp.mensagem,
          ambiente,
          cnpjMascarado: cnpjEmpresa ? mascararCnpj(cnpjEmpresa) : undefined,
          fonte: credenciais.fonte,
        }),
        502
      )
    }
    throw new ErroDaAplicacao(
      `Inconsistência com a Focus ao baixar o PDF: ${pdfResp.mensagem}`,
      codigoHttpClienteErroFocus(pdfResp.codigoHttp)
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

  const existente = await repositorioFocusNfe.buscarPorChave(companyId, chave)
  if (
    existente &&
    (existente.statusEntrada === 'entrada_contagem' ||
      existente.statusEntrada === 'entrada_contagem_ok' ||
      existente.statusEntrada === 'entrada_contagem_divergente' ||
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
    tipoDoc === 'nfse' || apos?.statusEntrada === 'pronta_para_consolidar'
      ? tipoDoc === 'nfse'
        ? 'NFS-e importada e pronta para consolidar (sem estoque).'
        : 'Nota documental importada e pronta para consolidar (sem contagem).'
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
      apos?.statusEntrada === 'entrada_contagem' || apos?.statusEntrada === 'pronta_para_consolidar'
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
  let xmlCompletadosFocus = 0

  let credenciais: { apiToken: string; homologacao: boolean } | null = null
  try {
    credenciais = await obterCredenciais(companyId)
  } catch {
    credenciais = null
  }

  for (const item of lista) {
    if (!item.xmlConteudo) continue
    const tipo = item.tipoDocumento ?? 'nfe55'

    // NFe 55 sem <det>: tenta completar na Focus (legado com nfeCompleta=true falso incluído).
    if (
      tipo === 'nfe55' &&
      credenciais &&
      !xmlNfeTemItensParseaveis(item.xmlConteudo)
    ) {
      const xmlRes = await completarXmlDaFocus(
        companyId,
        credenciais.apiToken,
        credenciais.homologacao,
        {
          chave_nfe: item.chaveNfe,
          manifestacao_destinatario: item.manifestacaoDestinatario ?? undefined,
          situacao: item.situacao ?? undefined,
        },
        () => undefined
      )
      if (xmlRes.ok) xmlCompletadosFocus += 1
      if (xmlRes.rateLimit) {
        logFocus('warn', 'reprocessar_xmls_rate_limit', { companyId, chave: item.chaveNfe.slice(-8) })
        break
      }
    }

    const atualizada = await repositorioFocusNfe.buscarPorChave(companyId, item.chaveNfe)
    const xmlAtual = atualizada?.xmlConteudo ?? item.xmlConteudo
    if (!xmlAtual) continue

    const campos = extrairCamposResumoDoXml(xmlAtual)
    // CT-e/NFS-e não têm det/prod de NFe — xmlNfeTemItensParseaveis seria false e
    // marcava nfeCompleta=false a cada BUSCAR, forçando re-download infinito no DistDFe.
    const nfeCompleta = tipo === 'nfe55' ? xmlNfeTemItensParseaveis(xmlAtual) : true
    await repositorioFocusNfe.upsertNfeRecebida({
      companyId,
      chaveNfe: item.chaveNfe,
      tipoDocumento: tipo,
      nomeEmitente: campos.nomeEmitente,
      documentoEmitente: campos.documentoEmitente,
      cnpjDestinatario: campos.cnpjDestinatario,
      dataEmissao: campos.dataEmissao,
      valorTotal: campos.valorTotal,
      xmlConteudo: xmlAtual,
      nfeCompleta,
      modFrete: tipo === 'nfe55' ? campos.modFrete ?? undefined : undefined,
    })
    ok += 1
    if (tipo === 'nfe55') {
      const { itensAdicionados } = await servicoEntradaNotas.sincronizarItensPendentesDoXml(
        companyId,
        item.id
      )
      if (itensAdicionados > 0) itensRecuperados += 1
    }
  }

  const ctesCanceladosTomador = await servicoEntradaNotas.repararCtesTomadorIndevido(companyId)
  const vinculosReparados = await servicoEntradaNotas.repararVinculosCteTomadorIndevido(companyId)
  const vinculadas = await servicoEntradaNotas.vincularFornecedoresNasNotasPendentes(companyId)
  const vinculosCte = await servicoEntradaNotas.processarVinculosCtePendentes(companyId, {
    importarFocusSeAusente: true,
    forcarRetryFocus: true,
  })
  logFocus('info', 'reprocessar_xmls', {
    companyId,
    ok,
    itensRecuperados,
    xmlCompletadosFocus,
    ctesCanceladosTomador,
    vinculosReparados,
    vinculadas,
    ctesVinculados: vinculosCte.vinculados,
    ctesImportFocus: vinculosCte.importadosFocus,
  })
  return {
    processados: ok,
    itensRecuperados,
    xmlCompletadosFocus,
    ctesCanceladosTomador,
    vinculosReparados,
    vinculadas,
    ctesVinculados: vinculosCte.vinculados,
    ctesImportFocus: vinculosCte.importadosFocus,
    mensagem:
      vinculadas > 0 ||
      vinculosCte.vinculados > 0 ||
      xmlCompletadosFocus > 0 ||
      vinculosReparados > 0 ||
      ctesCanceladosTomador > 0
        ? `${ok} nota(s) reprocessada(s); ${xmlCompletadosFocus} XML Focus; ${vinculadas} fornecedor(es); ${vinculosCte.vinculados} CT-e(s) vinculado(s); ${ctesCanceladosTomador} CT-e(s) cancelado(s) (tomador); ${vinculosReparados} vínculo(s) CT-e corrigido(s)${vinculosCte.importadosFocus > 0 ? ` (${vinculosCte.importadosFocus} NF via Focus)` : ''}.`
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

registrarHandlerJob(TIPO_JOB_FOCUS_SYNC, (contexto) =>
  executarSync(contexto.companyId, contexto)
)

export const servicoFocusNfe = {
  buscarConfig,
  salvarConfig,
  salvarRegrasFiscais,
  testarConexao,
  enfileirarSync,
  syncEmAndamento,
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
export { importarCtePorChave } from './importar-cte-por-chave.js'
