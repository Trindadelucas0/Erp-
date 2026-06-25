/**
 * Cliente HTTP para a API ZapSign.
 * Encapsula todas as chamadas externas com timeout, tratamento de erro
 * e alternância sandbox / produção.
 * Nunca lança exceção — sempre retorna um objeto tipado.
 */

const URL_SANDBOX = 'https://sandbox.api.zapsign.com.br/api/v1'
const URL_PRODUCAO = 'https://api.zapsign.com.br/api/v1'

const TIMEOUT_MS = 10_000

export type RespostaSucesso<T> = { sucesso: true; dados: T }
export type RespostaErro = { sucesso: false; mensagem: string; codigoHttp?: number }
export type RespostaZapsign<T> = RespostaSucesso<T> | RespostaErro

export interface DocumentoZapsign {
  token: string
  name: string
  status: string
  created_at: string
  signers: SignatarioZapsign[]
}

export interface SignatarioZapsign {
  token: string
  name: string
  email?: string
  phone_country?: string
  phone_number?: string
  sign_url: string
  status: string
  signed_at?: string
}

export interface CriarDocumentoBody {
  name: string
  url_pdf?: string
  base64_pdf?: string
  signers: {
    name: string
    email?: string
    send_automatic_email?: boolean
    send_automatic_whatsapp?: boolean
  }[]
  lang?: string
}

export interface ListaDocumentosZapsign {
  count: number
  next: string | null
  previous: string | null
  results: DocumentoZapsign[]
}

async function chamar<T>(
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  caminho: string,
  apiToken: string,
  sandbox: boolean,
  corpo?: unknown
): Promise<RespostaZapsign<T>> {
  const baseUrl = sandbox ? URL_SANDBOX : URL_PRODUCAO
  const url = `${baseUrl}${caminho}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const init: RequestInit = {
      method: metodo,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
    }

    if (corpo !== undefined) {
      init.body = JSON.stringify(corpo)
    }

    const resposta = await fetch(url, init)
    clearTimeout(timer)

    let dados: unknown = null
    try {
      const texto = await resposta.text()
      if (texto) dados = JSON.parse(texto)
    } catch {
      // corpo vazio ou não-JSON
    }

    if (!resposta.ok) {
      const detalhe =
        (dados as { detail?: string; message?: string } | null)?.detail ||
        (dados as { detail?: string; message?: string } | null)?.message ||
        `Erro HTTP ${resposta.status}`
      return { sucesso: false, mensagem: detalhe, codigoHttp: resposta.status }
    }

    return { sucesso: true, dados: dados as T }
  } catch (erro) {
    clearTimeout(timer)
    const err = erro as Error
    if (err.name === 'AbortError') {
      return {
        sucesso: false,
        mensagem: 'ZapSign não respondeu em 10 segundos. Verifique sua conexão.',
      }
    }
    return {
      sucesso: false,
      mensagem: `Falha na conexão com ZapSign: ${err.message}`,
    }
  }
}

export const clienteZapsign = {
  /**
   * Verifica se a API key é válida listando documentos (page_size=1).
   * 401 = token inválido, 200 = ok.
   */
  testarConexao(apiToken: string, sandbox: boolean) {
    return chamar<ListaDocumentosZapsign>(
      'GET',
      '/docs/?page_size=1',
      apiToken,
      sandbox
    )
  },

  criarDocumento(apiToken: string, sandbox: boolean, dados: CriarDocumentoBody) {
    return chamar<DocumentoZapsign>('POST', '/docs/', apiToken, sandbox, dados)
  },

  buscarDocumento(apiToken: string, sandbox: boolean, tokenDoc: string) {
    return chamar<DocumentoZapsign>('GET', `/docs/${tokenDoc}/`, apiToken, sandbox)
  },
}
