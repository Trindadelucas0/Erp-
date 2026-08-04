/**
 * Importa CT-e pela chave via Focus (XML DistDFe), independente do cursor.
 * Uso interno do sync/BUSCAR e fallback do vínculo — não é fluxo diário do usuário.
 *
 * Regra: todo CT-e que a Focus disponibiliza para o CNPJ da empresa é gravado
 * (DistDFe / chave). Não filtra por tomador do frete.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clienteFocusNfe } from './cliente-focus-nfe.js'
import { logFocus } from './logs-focus-nfe.js'
import { extrairCamposResumoDoXml } from './parser-xml-nfe.js'
import { repositorioFocusNfe } from './repositorio-focus-nfe.js'

export type ResultadoImportCtePorChave =
  | { ok: true; cteId: string; jaExistia: boolean; criado: boolean }
  | {
      ok: false
      motivo: 'chave_invalida' | 'xml_falhou' | 'rate_limit' | 'sem_focus'
      mensagem: string
    }

function lerTokenEnvFocus(): string | null {
  const token = process.env.FOCUS_NFE_TOKEN?.trim()
  return token || null
}

function lerHomologacaoEnvFocus(): boolean {
  const raw = (process.env.FOCUS_NFE_HOMOLOGACAO ?? 'true').trim().toLowerCase()
  if (raw === 'false' || raw === '0' || raw === 'nao' || raw === 'não') return false
  return true
}

async function obterCredenciaisFocus(companyId: string): Promise<{
  apiToken: string
  homologacao: boolean
}> {
  const config = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  if (config?.ativo && config.apiToken) {
    return {
      apiToken: config.apiToken.trim(),
      homologacao: config.homologacao,
    }
  }
  const tokenEnv = lerTokenEnvFocus()
  if (tokenEnv) {
    return { apiToken: tokenEnv, homologacao: lerHomologacaoEnvFocus() }
  }
  throw new ErroDaAplicacao(
    'Focus NFe não configurado. Acesse Configurações → Focus NFe ou defina FOCUS_NFE_TOKEN.',
    400
  )
}

export type OpcoesImportCtePorChave = {
  apiToken?: string
  homologacao?: boolean
  versaoFocus?: number
  situacao?: string | null
  /** Se true, não roda processarAposXml (caller cuida). Default: processa. */
  pularPipeline?: boolean
}

async function upsertEPipeline(
  companyId: string,
  chave: string,
  xml: string,
  opcoes?: OpcoesImportCtePorChave,
  existente?: { situacao: string | null; versaoFocus: number | null } | null
): Promise<{ criado: boolean; cteId: string }> {
  const campos = extrairCamposResumoDoXml(xml)
  const { criado, registro } = await repositorioFocusNfe.upsertNfeRecebida({
    companyId,
    chaveNfe: chave,
    tipoDocumento: 'cte',
    nomeEmitente: campos.nomeEmitente,
    documentoEmitente: campos.documentoEmitente,
    cnpjDestinatario: campos.cnpjDestinatario,
    dataEmissao: campos.dataEmissao,
    valorTotal: campos.valorTotal,
    xmlConteudo: xml,
    nfeCompleta: true,
    origem: 'focus',
    situacao: opcoes?.situacao ?? existente?.situacao ?? 'autorizada',
    versaoFocus: opcoes?.versaoFocus ?? existente?.versaoFocus ?? 0,
    etapaAtual: 'servico',
  })

  if (!opcoes?.pularPipeline) {
    const { servicoEntradaNotas } = await import('../entrada-notas/servico-pipeline-entrada.js')
    await servicoEntradaNotas.processarAposXml(companyId, registro.id)
  }

  return { criado, cteId: registro.id }
}

/**
 * Garante CT-e local a partir da chave (44 dígitos, modelo 57).
 * Persiste todo CT-e disponível na Focus para este token/CNPJ (não exige tomador).
 */
export async function importarCtePorChave(
  companyId: string,
  chaveCteBruta: string,
  opcoes?: OpcoesImportCtePorChave
): Promise<ResultadoImportCtePorChave> {
  const chave = chaveCteBruta.replace(/\D/g, '')
  if (chave.length !== 44 || chave.slice(20, 22) !== '57') {
    return {
      ok: false,
      motivo: 'chave_invalida',
      mensagem: 'Chave de CT-e inválida (esperado 44 dígitos, modelo 57).',
    }
  }

  const existente = await repositorioFocusNfe.buscarPorChave(companyId, chave)
  if (existente?.xmlConteudo && existente.nfeCompleta) {
    return { ok: true, cteId: existente.id, jaExistia: true, criado: false }
  }

  if (existente?.xmlConteudo) {
    const { criado, cteId } = await upsertEPipeline(
      companyId,
      chave,
      existente.xmlConteudo,
      opcoes,
      existente
    )
    return { ok: true, cteId, jaExistia: true, criado }
  }

  let apiToken = opcoes?.apiToken
  let homologacao = opcoes?.homologacao
  if (!apiToken || homologacao === undefined) {
    try {
      const cred = await obterCredenciaisFocus(companyId)
      apiToken = cred.apiToken
      homologacao = cred.homologacao
    } catch (e) {
      const msg = e instanceof ErroDaAplicacao ? e.message : 'Focus NFe não configurado.'
      return { ok: false, motivo: 'sem_focus', mensagem: msg }
    }
  }

  const xmlResp = await clienteFocusNfe.baixarXmlCte(apiToken, homologacao, chave)
  if (!xmlResp.sucesso || typeof xmlResp.dados !== 'string') {
    const rateLimit = xmlResp.sucesso === false && xmlResp.codigoHttp === 429
    const detalhe =
      xmlResp.sucesso === false ? xmlResp.mensagem : 'XML vazio ou indisponível na Focus'
    logFocus('warn', 'import_chave_cte_xml_falhou', {
      companyId,
      chave: chave.slice(-8),
      mensagem: detalhe,
      codigoHttp: xmlResp.sucesso === false ? xmlResp.codigoHttp : undefined,
    })
    if (rateLimit) {
      return {
        ok: false,
        motivo: 'rate_limit',
        mensagem: `Focus rate limit (429) ao baixar XML do CT-e …${chave.slice(-8)}.`,
      }
    }
    return {
      ok: false,
      motivo: 'xml_falhou',
      mensagem: `Falha ao baixar XML do CT-e …${chave.slice(-8)}: ${detalhe}`,
    }
  }

  const { criado, cteId } = await upsertEPipeline(
    companyId,
    chave,
    xmlResp.dados,
    opcoes,
    existente
  )

  logFocus('info', 'import_chave_cte_ok', {
    companyId,
    chave: chave.slice(-8),
    cteId,
    criado,
  })

  return { ok: true, cteId, jaExistia: !criado, criado }
}
