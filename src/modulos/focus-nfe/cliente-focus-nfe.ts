/**
 * Cliente HTTP Focus NFe — único ponto de fetch externo.
 *
 * Docs oficiais (escopo = NFe 55 + NFS-e nacional + CTe recebidos; sem emissão):
 * - Intro: https://doc.focusnfe.com.br/reference/introducao
 * - Auth Basic (token:): https://doc.focusnfe.com.br/reference/autenticacao
 * - Ambientes: https://doc.focusnfe.com.br/reference/ambiente
 * - NFe: GET /v2/nfes_recebidas?cnpj=&versao=
 * - NFS-e: GET /v2/nfsens_recebidas?cnpj=&versao=
 * - CTe: GET /v2/ctes_recebidas?cnpj=&versao=
 * - Manifestar NFe: POST /v2/nfes_recebidas/{chave}/manifesto
 * - Empresa: habilita_manifestacao / Recebimento de NFSes / CTe recebidas
 *
 * Auth: Basic (token como usuário, senha vazia).
 * Nunca lança — retorna objeto tipado.
 */
import { logFocus, logFocusVerbose } from './logs-focus-nfe.js'

/** @see https://doc.focusnfe.com.br/reference/ambiente */
const URL_HOMOLOG = 'https://homologacao.focusnfe.com.br/v2'
const URL_PROD = 'https://api.focusnfe.com.br/v2'
const TIMEOUT_MS = 20_000
/** Intervalo mínimo entre chamadas (proteção local; Focus pagina 100 itens). */
const INTERVALO_MIN_MS = 650
const MAX_TENTATIVAS_429 = 3

export type RespostaSucesso<T> = {
  sucesso: true
  dados: T
  headers: Record<string, string>
  codigoHttp: number
}
export type RespostaErro = {
  sucesso: false
  mensagem: string
  codigoHttp?: number
  codigo?: string
}
export type RespostaFocus<T> = RespostaSucesso<T> | RespostaErro

export type NfeRecebidaResumoFocus = {
  nome_emitente?: string
  documento_emitente?: string
  cnpj_destinatario?: string
  chave_nfe: string
  valor_total?: string
  data_emissao?: string
  situacao?: string
  manifestacao_destinatario?: string | null
  nfe_completa?: boolean | string
  tipo_nfe?: string
  versao?: number
}

/** Resumo NFS-e nacional / municipal recebida (campos flexíveis da Focus). */
export type NfseRecebidaResumoFocus = {
  chave?: string
  chave_acesso?: string
  chave_nfse?: string
  versao?: number
  status?: string
  situacao?: string
  numero?: string
  data_emissao?: string
  valor_servicos?: string
  valor_total?: string
  documento_prestador?: string
  nome_prestador?: string | null
  documento_tomador?: string | null
  cnpj_tomador?: string | null
  url_xml?: string | null
}

/** Resumo CTe recebido (campos flexíveis da Focus). */
export type CteRecebidaResumoFocus = {
  chave?: string
  chave_acesso?: string
  chave_cte?: string
  versao?: number
  status?: string
  situacao?: string
  data_emissao?: string
  valor_total?: string
  valor_prestacao?: string
  documento_emitente?: string
  nome_emitente?: string | null
  documento_destinatario?: string | null
  cnpj_destinatario?: string | null
  documento_tomador?: string | null
  nome_tomador?: string | null
}

let ultimaChamadaEm = 0

async function aguardarRateLimit(): Promise<void> {
  const agora = Date.now()
  const espera = INTERVALO_MIN_MS - (agora - ultimaChamadaEm)
  if (espera > 0) {
    logFocusVerbose('rate_limit_espera', { ms: espera })
    await new Promise((r) => setTimeout(r, espera))
  }
  ultimaChamadaEm = Date.now()
}

function montarAuth(token: string): string {
  return `Basic ${Buffer.from(`${token}:`, 'utf8').toString('base64')}`
}

function baseUrl(homologacao: boolean): string {
  return homologacao ? URL_HOMOLOG : URL_PROD
}

/** Extrai segundos de espera de mensagens tipo "Tente novamente em 4 segundos". */
function segundosEspera429(mensagem: string): number {
  const m = mensagem.match(/(\d+)\s*segundo/i)
  if (m) {
    const n = Number(m[1])
    if (Number.isFinite(n) && n > 0) return Math.min(n, 60)
  }
  return 5
}

async function chamarUmaVez<T>(
  metodo: 'GET' | 'POST' | 'DELETE',
  caminho: string,
  apiToken: string,
  homologacao: boolean,
  opcoes?: { corpo?: unknown; query?: Record<string, string | number | undefined>; accept?: string }
): Promise<RespostaFocus<T>> {
  await aguardarRateLimit()

  const urlBase = baseUrl(homologacao)
  const params = new URLSearchParams()
  if (opcoes?.query) {
    for (const [k, v] of Object.entries(opcoes.query)) {
      if (v !== undefined && v !== '') params.set(k, String(v))
    }
  }
  const qs = params.toString()
  const url = `${urlBase}${caminho}${qs ? `?${qs}` : ''}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const inicio = Date.now()

  try {
    const init: RequestInit = {
      method: metodo,
      headers: {
        Authorization: montarAuth(apiToken),
        Accept: opcoes?.accept ?? 'application/json',
      },
      signal: controller.signal,
    }

    if (opcoes?.corpo !== undefined) {
      ;(init.headers as Record<string, string>)['Content-Type'] = 'application/json'
      init.body = JSON.stringify(opcoes.corpo)
    }

    const resposta = await fetch(url, init)
    clearTimeout(timer)
    const ms = Date.now() - inicio

    const headers: Record<string, string> = {}
    resposta.headers.forEach((valor, chave) => {
      headers[chave.toLowerCase()] = valor
    })

    const contentType = headers['content-type'] ?? ''
    let dados: unknown = null
    const texto = await resposta.text()

    if (opcoes?.accept === 'application/xml' || contentType.includes('xml')) {
      dados = texto
    } else if (texto) {
      try {
        dados = JSON.parse(texto)
      } catch {
        dados = texto
      }
    }

    if (!resposta.ok) {
      const corpo = dados as { codigo?: string; mensagem?: string; message?: string } | null
      const mensagem =
        corpo?.mensagem || corpo?.message || `Erro HTTP ${resposta.status}`
      logFocus('error', 'api_erro', {
        metodo,
        path: caminho,
        http: resposta.status,
        codigo: corpo?.codigo ?? '',
        mensagem,
        ms,
      })
      return {
        sucesso: false,
        mensagem,
        codigoHttp: resposta.status,
        codigo: corpo?.codigo,
      }
    }

    logFocusVerbose('api_ok', { metodo, path: caminho, http: resposta.status, ms })
    return { sucesso: true, dados: dados as T, headers, codigoHttp: resposta.status }
  } catch (erro) {
    clearTimeout(timer)
    const err = erro as Error
    const mensagem =
      err.name === 'AbortError'
        ? `Focus NFe não respondeu em ${TIMEOUT_MS / 1000}s`
        : `Falha na conexão com Focus NFe: ${err.message}`
    logFocus('error', 'api_erro', { metodo, path: caminho, mensagem })
    return { sucesso: false, mensagem }
  }
}

async function chamar<T>(
  metodo: 'GET' | 'POST' | 'DELETE',
  caminho: string,
  apiToken: string,
  homologacao: boolean,
  opcoes?: { corpo?: unknown; query?: Record<string, string | number | undefined>; accept?: string }
): Promise<RespostaFocus<T>> {
  let ultima: RespostaFocus<T> | null = null
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_429; tentativa += 1) {
    ultima = await chamarUmaVez<T>(metodo, caminho, apiToken, homologacao, opcoes)
    if (ultima.sucesso || ultima.codigoHttp !== 429) return ultima

    if (tentativa >= MAX_TENTATIVAS_429) break

    const esperaSec = segundosEspera429(ultima.mensagem)
    logFocus('warn', 'rate_limit_retry', {
      path: caminho,
      tentativa,
      esperaSec,
      mensagem: ultima.mensagem,
    })
    await new Promise((r) => setTimeout(r, esperaSec * 1000))
  }
  return ultima!
}

async function baixarPdfUmaVez(
  apiToken: string,
  homologacao: boolean,
  caminho: string
): Promise<RespostaFocus<Buffer>> {
  await aguardarRateLimit()

  const url = `${baseUrl(homologacao)}${caminho}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const inicio = Date.now()

  try {
    const resposta = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: montarAuth(apiToken),
        Accept: 'application/pdf',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timer)
    const ms = Date.now() - inicio
    const headers: Record<string, string> = {}
    resposta.headers.forEach((valor, chave) => {
      headers[chave.toLowerCase()] = valor
    })

    if (!resposta.ok) {
      let mensagem = `Erro HTTP ${resposta.status}`
      let codigo: string | undefined
      try {
        const corpo = (await resposta.json()) as {
          codigo?: string
          mensagem?: string
          message?: string
        }
        mensagem = corpo.mensagem || corpo.message || mensagem
        codigo = corpo.codigo
      } catch {
        /* corpo não JSON */
      }
      logFocus('error', 'api_erro', {
        metodo: 'GET',
        path: caminho,
        http: resposta.status,
        codigo: codigo ?? '',
        mensagem,
        ms,
      })
      return { sucesso: false, mensagem, codigoHttp: resposta.status, codigo }
    }

    const ab = await resposta.arrayBuffer()
    const buffer = Buffer.from(ab)
    if (buffer.length < 5 || buffer.subarray(0, 4).toString('utf8') !== '%PDF') {
      logFocus('error', 'api_erro', {
        metodo: 'GET',
        path: caminho,
        http: resposta.status,
        mensagem: 'Resposta não é PDF válido',
        ms,
      })
      return {
        sucesso: false,
        mensagem: 'Focus não devolveu um PDF válido.',
        codigoHttp: 502,
      }
    }

    logFocusVerbose('api_ok', {
      metodo: 'GET',
      path: caminho,
      http: resposta.status,
      ms,
      bytes: buffer.length,
    })
    return { sucesso: true, dados: buffer, headers, codigoHttp: resposta.status }
  } catch (erro) {
    clearTimeout(timer)
    const err = erro as Error
    const mensagem =
      err.name === 'AbortError'
        ? `Focus NFe não respondeu em ${TIMEOUT_MS / 1000}s`
        : `Falha na conexão com Focus NFe: ${err.message}`
    logFocus('error', 'api_erro', { metodo: 'GET', path: caminho, mensagem })
    return { sucesso: false, mensagem }
  }
}

async function baixarPdfBinario(
  apiToken: string,
  homologacao: boolean,
  caminho: string
): Promise<RespostaFocus<Buffer>> {
  let ultima: RespostaFocus<Buffer> | null = null
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_429; tentativa += 1) {
    ultima = await baixarPdfUmaVez(apiToken, homologacao, caminho)
    if (ultima.sucesso || ultima.codigoHttp !== 429) return ultima
    if (tentativa >= MAX_TENTATIVAS_429) break
    const esperaSec = segundosEspera429(ultima.mensagem)
    logFocus('warn', 'rate_limit_retry', {
      path: caminho,
      tentativa,
      esperaSec,
      mensagem: ultima.mensagem,
    })
    await new Promise((r) => setTimeout(r, esperaSec * 1000))
  }
  return ultima!
}

export const clienteFocusNfe = {
  /**
   * Valida token + CNPJ com o endpoint real de NFe recebidas.
   * Lista vazia (200) = OK. Não usa /empresas (404 em token de empresa).
   */
  testarConexao(apiToken: string, homologacao: boolean, cnpj: string) {
    return chamar<NfeRecebidaResumoFocus[]>('GET', '/nfes_recebidas', apiToken, homologacao, {
      query: {
        cnpj: cnpj.replace(/\D/g, ''),
      },
    })
  },

  listarNfesRecebidas(
    apiToken: string,
    homologacao: boolean,
    cnpj: string,
    versao?: number,
    opcoes?: { pendente?: number; pendenteCiencia?: number }
  ) {
    return chamar<NfeRecebidaResumoFocus[]>('GET', '/nfes_recebidas', apiToken, homologacao, {
      query: {
        cnpj: cnpj.replace(/\D/g, ''),
        versao: versao && versao > 0 ? versao : undefined,
        pendente: opcoes?.pendente,
        pendente_ciencia: opcoes?.pendenteCiencia,
      },
    })
  },

  listarNfsesRecebidas(apiToken: string, homologacao: boolean, cnpj: string, versao?: number) {
    return chamar<NfseRecebidaResumoFocus[]>('GET', '/nfsens_recebidas', apiToken, homologacao, {
      query: {
        cnpj: cnpj.replace(/\D/g, ''),
        versao: versao && versao > 0 ? versao : undefined,
      },
    })
  },

  listarCtesRecebidas(apiToken: string, homologacao: boolean, cnpj: string, versao?: number) {
    return chamar<CteRecebidaResumoFocus[]>('GET', '/ctes_recebidas', apiToken, homologacao, {
      query: {
        cnpj: cnpj.replace(/\D/g, ''),
        versao: versao && versao > 0 ? versao : undefined,
      },
    })
  },

  baixarXmlNfse(apiToken: string, homologacao: boolean, chave: string) {
    return chamar<string>('GET', `/nfsens_recebidas/${chave}.xml`, apiToken, homologacao, {
      accept: 'application/xml',
    })
  },

  baixarXmlCte(apiToken: string, homologacao: boolean, chave: string) {
    return chamar<string>('GET', `/ctes_recebidas/${chave}.xml`, apiToken, homologacao, {
      accept: 'application/xml',
    })
  },

  manifestar(
    apiToken: string,
    homologacao: boolean,
    chaveNfe: string,
    tipo: string,
    justificativa?: string
  ) {
    return chamar<unknown>(
      'POST',
      `/nfes_recebidas/${chaveNfe}/manifesto`,
      apiToken,
      homologacao,
      { corpo: { tipo, ...(justificativa ? { justificativa } : {}) } }
    )
  },

  baixarXml(apiToken: string, homologacao: boolean, chaveNfe: string) {
    return chamar<string>('GET', `/nfes_recebidas/${chaveNfe}.xml`, apiToken, homologacao, {
      accept: 'application/xml',
    })
  },

  /**
   * PDF DANFE — NFe 55 recebida.
   * @see https://doc.focusnfe.com.br/reference/consultar_nfe_recebida_individual_pdf
   */
  baixarPdfNfe(apiToken: string, homologacao: boolean, chave: string) {
    return baixarPdfBinario(apiToken, homologacao, `/nfes_recebidas/${chave}.pdf`)
  },

  /**
   * PDF DANFSe — NFS-e nacional recebida.
   * @see https://doc.focusnfe.com.br/reference/consultar_nfsen_recebida_individual_pdf
   */
  baixarPdfNfse(apiToken: string, homologacao: boolean, chave: string) {
    return baixarPdfBinario(apiToken, homologacao, `/nfsens_recebidas/${chave}.pdf`)
  },

  /**
   * PDF DACTe — CTe recebido.
   * @see https://doc.focusnfe.com.br/reference/consultar_ctes_recebidas
   */
  baixarPdfCte(apiToken: string, homologacao: boolean, chave: string) {
    return baixarPdfBinario(apiToken, homologacao, `/ctes_recebidas/${chave}.pdf`)
  },

  /** @deprecated use baixarPdfNfe */
  baixarDanfePdf(apiToken: string, homologacao: boolean, chaveNfe: string) {
    return baixarPdfBinario(apiToken, homologacao, `/nfes_recebidas/${chaveNfe}.pdf`)
  },

  consultarJson(apiToken: string, homologacao: boolean, chaveNfe: string) {
    return chamar<unknown>('GET', `/nfes_recebidas/${chaveNfe}.json`, apiToken, homologacao)
  },
}
