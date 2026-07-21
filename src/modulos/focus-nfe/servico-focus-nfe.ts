/**
 * Regras de negócio Focus NFe / Entrada de Notas (base).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clienteFocusNfe, type NfeRecebidaResumoFocus, type NfseRecebidaResumoFocus, type RespostaFocus } from './cliente-focus-nfe.js'
import { tentarTravarFocus, liberarTravaFocus } from './fila-focus-nfe.js'
import { logFocus } from './logs-focus-nfe.js'
import {
  mascararCnpj,
  mensagemErroFocusAmigavel,
  normalizarCnpj,
} from './mensagens-focus-nfe.js'
import { extrairCamposResumoDoXml, normalizarXmlNfe, detectarDocumentoFiscalXml, montarVisualizacaoDoXml } from './parser-xml-nfe.js'
import { repositorioFocusNfe } from './repositorio-focus-nfe.js'
import { lerDanfe, lerDanfePorCaminho, salvarDanfe } from './armazenamento-danfe.js'
import type { DadosParaSalvarConfigFocus, DadosRegrasFiscais } from './esquema-focus-nfe.js'
import { REGRAS_FISCAIS_PADRAO, sanitizarRegrasFiscais } from './esquema-focus-nfe.js'
import { analisarFiscalBasico } from '../entrada-notas/analise-fiscal/analisar-fiscal-basico.js'
import { servicoEntradaNotas } from '../entrada-notas/servico-pipeline-entrada.js'

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

const LIMITE_LOTE_SYNC = 10

type ResultadoXml = {
  ok: boolean
  rateLimit: boolean
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
    pushLog(`fonte=${credenciais.fonte} ambiente=${ambiente} cnpj=${cnpjMascarado} lote=${LIMITE_LOTE_SYNC}`)

    let processados = 0
    let novas = 0
    let atualizadas = 0
    let novasNfse = 0
    let atualizadasNfse = 0
    let rateLimit = false
    let versao = credenciais.ultimaVersao
    let maxVersao = versao
    let versaoNfse = credenciais.ultimaVersaoNfse
    let maxVersaoNfse = versaoNfse

    // --- NFe 55 ---
    if (processados < LIMITE_LOTE_SYNC && !rateLimit) {
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

        logFocus('info', 'sync_pagina', {
          companyId,
          versaoDe: versao,
          qtd: lista.length,
          maxVersao: maxDaPagina || '',
          cnpj: cnpjMascarado,
          limite: LIMITE_LOTE_SYNC,
        })
        pushLog(`nfe página: ${lista.length} (versão≥${versao}, processar até ${LIMITE_LOTE_SYNC})`)

        for (const item of lista) {
          if (processados >= LIMITE_LOTE_SYNC || rateLimit) break
          if (!item.chave_nfe) continue

          const mapeado = mapearResumo(item)
          const { criado } = await repositorioFocusNfe.upsertNfeRecebida({
            companyId,
            ...mapeado,
            origem: 'focus',
          })
          if (criado) novas += 1
          else atualizadas += 1
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

        if (maxDaPagina > maxVersao) maxVersao = maxDaPagina
        if (temConfigBanco && maxVersao > credenciais.ultimaVersao) {
          await repositorioFocusNfe.atualizarUltimaVersao(companyId, maxVersao)
          credenciais.ultimaVersao = maxVersao
        }
      }
    }

    // --- NFS-e nacional ---
    if (processados < LIMITE_LOTE_SYNC && !rateLimit) {
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
          if (processados >= LIMITE_LOTE_SYNC || rateLimit) break
          const chave = chaveNfseFocus(item)
          if (!chave) continue

          const mapeado = mapearResumoNfse(item)
          const { criado, registro } = await repositorioFocusNfe.upsertNfeRecebida({
            companyId,
            ...mapeado,
            origem: 'focus',
          })
          if (criado) novasNfse += 1
          else atualizadasNfse += 1
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

        if (maxDaPaginaNfse > maxVersaoNfse) maxVersaoNfse = maxDaPaginaNfse
        if (temConfigBanco && maxVersaoNfse > credenciais.ultimaVersaoNfse) {
          await repositorioFocusNfe.atualizarUltimaVersaoNfse(companyId, maxVersaoNfse)
          credenciais.ultimaVersaoNfse = maxVersaoNfse
        }
      }
    }

    logFocus('info', 'sync_persistidas', {
      companyId,
      novas,
      atualizadas,
      novasNfse,
      atualizadasNfse,
      processados,
      rateLimit,
    })
    pushLog(
      `fim lote: processados=${processados} nfe +${novas}/~${atualizadas}; nfse +${novasNfse}/~${atualizadasNfse}${
        rateLimit ? ' (rate limit)' : ''
      }`
    )

    const totalNovas = novas + novasNfse
    const totalAtualizadas = atualizadas + atualizadasNfse
    let mensagemFim: string
    if (rateLimit) {
      mensagemFim = `Lote pausado por rate limit Focus após ${processados} nota(s). Já salvas no sistema; retoma no próximo ciclo (auto ~2 min).`
    } else if (processados >= LIMITE_LOTE_SYNC) {
      mensagemFim = `Lote de ${LIMITE_LOTE_SYNC} concluído (NFe +${novas}/~${atualizadas}; NFS-e +${novasNfse}/~${atualizadasNfse}). Próximas no sync automático.`
    } else if (totalNovas === 0 && totalAtualizadas === 0) {
      mensagemFim =
        'Sync OK, Focus sem novidades neste lote (0 NFe / 0 NFS-e novas neste cursor). Lista e busca usam só o banco local.'
    } else {
      mensagemFim = `Sync OK: NFe ${novas} novas / ${atualizadas} atualizadas; NFS-e ${novasNfse} novas / ${atualizadasNfse} atualizadas.`
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

async function completarXmlDaFocus(
  companyId: string,
  apiToken: string,
  homologacao: boolean,
  item: NfeRecebidaResumoFocus,
  pushLog: (msg: string) => void
): Promise<ResultadoXml> {
  const chave = item.chave_nfe
  const existente = await repositorioFocusNfe.buscarPorChave(companyId, chave)
  if (existente?.xmlConteudo && existente.nfeCompleta) {
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
    nfeCompleta: true,
    origem: 'focus',
    situacao: item.situacao ?? 'autorizada',
    manifestacaoDestinatario: item.manifestacao_destinatario ?? 'ciencia',
  })
  await servicoEntradaNotas.processarAposXml(companyId, registro.id)
  return { ok: true, rateLimit: false }
}

async function enfileirarSync(companyId: string, opcoes?: { completo?: boolean }) {
  if (!tentarTravarFocus(companyId)) {
    logFocus('warn', 'job_recusado_409', { companyId, motivo: 'ja_em_andamento' })
    throw new ErroDaAplicacao('Já existe uma sincronização Focus em andamento para esta empresa.', 409)
  }

  try {
    await obterCredenciais(companyId)
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
    payloadJson: { completo: opcoes?.completo === true },
  })
  logFocus('info', 'job_criado', { id: job.id, tipo: 'sync', companyId, completo: !!opcoes?.completo })

  setImmediate(() => {
    void executarSync(companyId, job.id)
  })

  return { jobId: job.id, status: job.status }
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
    }
  })
}

/**
 * Obtém XML da nota: banco primeiro; se faltar, busca na Focus, salva e processa.
 * Inclui `visualizacao` legível (cabeçalho + itens) montada a partir do XML.
 */
async function obterXmlNota(companyId: string, id: string) {
  const nota = await repositorioFocusNfe.buscarPorId(companyId, id)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada.', 404)

  let xml = nota.xmlConteudo
  let origemXml: 'banco' | 'focus' = 'banco'

  if (!xml) {
    const credenciais = await obterCredenciais(companyId)
    const ehNfse = nota.tipoDocumento === 'nfse'
    const xmlResp = ehNfse
      ? await clienteFocusNfe.baixarXmlNfse(
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
    await repositorioFocusNfe.upsertNfeRecebida({
      companyId,
      chaveNfe: nota.chaveNfe,
      tipoDocumento: ehNfse ? 'nfse' : 'nfe55',
      nomeEmitente: campos.nomeEmitente ?? nota.nomeEmitente,
      documentoEmitente: campos.documentoEmitente ?? nota.documentoEmitente,
      cnpjDestinatario: campos.cnpjDestinatario ?? nota.cnpjDestinatario,
      dataEmissao: campos.dataEmissao ?? nota.dataEmissao,
      valorTotal: campos.valorTotal ?? (nota.valorTotal != null ? Number(nota.valorTotal) : null),
      xmlConteudo: xml,
      nfeCompleta: true,
      origem: 'focus',
    })
    await servicoEntradaNotas.processarAposXml(companyId, nota.id)
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
  if (visualizacao.tipoDocumento === 'desconhecido' && nota.tipoDocumento === 'nfse') {
    visualizacao.tipoDocumento = 'nfse'
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
 * DANFE/DANFSe (PDF): cache local primeiro; Focus só se necessário.
 * NFe 55 + NFS-e nacional.
 */
async function obterDanfeNota(companyId: string, id: string) {
  const nota = await repositorioFocusNfe.buscarPorId(companyId, id)
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada.', 404)

  const ehNfse = nota.tipoDocumento === 'nfse'
  const agora = Date.now()
  const atualizadoEm = nota.danfeAtualizadoEm?.getTime() ?? 0
  const dentroDe24h = agora - atualizadoEm < 24 * 60 * 60 * 1000
  const dentroDe2min = agora - atualizadoEm < 2 * 60 * 1000

  // 1) Cache em disco
  if (nota.danfeCaminho) {
    const local = await lerDanfePorCaminho(nota.danfeCaminho)
    if (local) {
      if (nota.danfeStatus !== 'ok') {
        await repositorioFocusNfe.atualizarDanfe(nota.id, {
          danfeStatus: 'ok',
          danfeAtualizadoEm: new Date(),
        })
      }
      return { id: nota.id, chaveNfe: nota.chaveNfe, tipoDocumento: nota.tipoDocumento, pdf: local, origem: 'cache' as const }
    }
  }
  const localPorId = await lerDanfe(companyId, nota.id)
  if (localPorId) {
    const caminho = await salvarDanfe(companyId, nota.id, localPorId)
    await repositorioFocusNfe.atualizarDanfe(nota.id, {
      danfeCaminho: caminho,
      danfeStatus: 'ok',
      danfeAtualizadoEm: new Date(),
    })
    return { id: nota.id, chaveNfe: nota.chaveNfe, tipoDocumento: nota.tipoDocumento, pdf: localPorId, origem: 'cache' as const }
  }

  // 2) Status recente: não martelar a Focus
  if (nota.danfeStatus === 'indisponivel' && dentroDe24h) {
    throw new ErroDaAplicacao(
      'PDF ainda indisponível na Focus para esta nota. Use Ver nota ou tente amanhã. (ciência/XML podem ser necessários)',
      422
    )
  }
  if (nota.danfeStatus === 'rate_limit' && dentroDe2min) {
    throw new ErroDaAplicacao(
      'Limite da Focus excedido recentemente. Aguarde cerca de 1–2 minutos e tente de novo.',
      429
    )
  }

  const credenciais = await obterCredenciais(companyId)
  const chave = nota.chaveNfe

  // 3) NFe: garantir ciência + XML antes do PDF
  if (!ehNfse && !(nota.xmlConteudo && nota.nfeCompleta)) {
    const man = (nota.manifestacaoDestinatario ?? '').toLowerCase()
    if (!man || man === 'nulo' || man === 'null') {
      await clienteFocusNfe.manifestar(
        credenciais.apiToken,
        credenciais.homologacao,
        chave,
        'ciencia'
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
    return ehNfse
      ? clienteFocusNfe.baixarPdfNfse(
          credenciais.apiToken,
          credenciais.homologacao,
          chave
        )
      : clienteFocusNfe.baixarPdfNfe(
          credenciais.apiToken,
          credenciais.homologacao,
          chave
        )
  }

  let pdfResp = await tentarPdf()

  // 4) 404: um retry após nova ciência/XML (NFe)
  if (!pdfResp.sucesso && pdfResp.codigoHttp === 404 && !ehNfse) {
    await clienteFocusNfe.manifestar(
      credenciais.apiToken,
      credenciais.homologacao,
      chave,
      'ciencia'
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
          : 'DANFE ainda não disponível na Focus (pode faltar ciência ou o PDF ainda não foi gerado). Use Ver nota.',
        422
      )
    }
    throw new ErroDaAplicacao(
      `Não foi possível baixar o PDF: ${pdfResp.mensagem}`,
      pdfResp.codigoHttp ?? 502
    )
  }

  const caminho = await salvarDanfe(companyId, nota.id, pdfResp.dados)
  await repositorioFocusNfe.atualizarDanfe(nota.id, {
    danfeCaminho: caminho,
    danfeStatus: 'ok',
    danfeAtualizadoEm: new Date(),
  })

  return {
    id: nota.id,
    chaveNfe: nota.chaveNfe,
    tipoDocumento: nota.tipoDocumento,
    pdf: pdfResp.dados,
    origem: 'focus' as const,
  }
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
      'XML não reconhecido. Envie XML de NFe modelo 55 (produto) ou NFS-e nacional (serviço) — não DANFE PDF.',
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
        : 'Não foi possível extrair a chave (44 dígitos) do XML. Confirme que o arquivo é o XML da NF-e (não DANFE PDF nem evento).',
      400
    )
  }

  const existente = await repositorioFocusNfe.buscarPorChave(companyId, chave)
  if (
    existente &&
    (existente.statusEntrada === 'entrada_contagem' ||
      existente.statusEntrada === 'entrada_consolidada')
  ) {
    throw new ErroDaAplicacao(
      `NF ${chave} já teve entrada. Duplicidade bloqueada pela chave.`,
      409
    )
  }

  const { registro, criado } = await repositorioFocusNfe.upsertNfeRecebida({
    companyId,
    chaveNfe: chave,
    tipoDocumento: tipoDoc === 'nfse' ? 'nfse' : 'nfe55',
    nomeEmitente: campos.nomeEmitente,
    documentoEmitente: campos.documentoEmitente,
    cnpjDestinatario: campos.cnpjDestinatario,
    dataEmissao: campos.dataEmissao,
    valorTotal: campos.valorTotal,
    xmlConteudo: xml,
    nfeCompleta: true,
    origem: 'xml',
    situacao: existente?.situacao ?? 'autorizada',
    etapaAtual: tipoDoc === 'nfse' ? 'servico' : 'cadastro',
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

  return {
    id: registro.id,
    chaveNfe: registro.chaveNfe,
    tipoDocumento: tipoDoc === 'nfse' ? 'nfse' : 'nfe55',
    criado,
    statusEntrada: apos?.statusEntrada ?? registro.statusEntrada,
    etapaAtual: apos?.etapaAtual ?? registro.etapaAtual,
    mensagem:
      apos?.statusEntrada === 'entrada_contagem'
        ? tipoDoc === 'nfse'
          ? 'NFS-e importada e liberada para contagem documental (sem estoque).'
          : 'XML importado e entrada automática (Liberar para contagem) — sem críticas bloqueantes.'
        : criado
          ? 'XML importado. Abra a nota para concluir a análise de entrada.'
          : 'XML atualizado. Abra a nota para concluir a análise de entrada.',
  }
}

async function reprocessarXmlsLocais(companyId: string) {
  const lista = await repositorioFocusNfe.listarComXmlPendenteCampos(companyId)
  let ok = 0
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
      nfeCompleta: true,
    })
    ok += 1
  }
  logFocus('info', 'reprocessar_xmls', { companyId, ok })
  return {
    processados: ok,
    mensagem: `${ok} nota(s) reprocessada(s) a partir do XML salvo (emitente, data, valor).`,
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
  statusJob,
  listarPendentes,
  obterXmlNota,
  obterDanfeNota,
  importarXml,
  reprocessarXmlsLocais,
  previewAnaliseFiscal,
}
