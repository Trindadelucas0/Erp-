/**
 * Extrai mensagem legível de erros retornados pela API (Axios) ou da rede.
 * O backend retorna { mensagem } nos erros controlados — este helper garante
 * que o frontend sempre mostre a causa real, nunca um texto genérico.
 */

type CorpoErroApi = { mensagem?: string; message?: string }

function textoDeBuffer(dados: ArrayBuffer | ArrayBufferView): string {
  const view =
    dados instanceof ArrayBuffer
      ? new Uint8Array(dados)
      : new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength)
  return new TextDecoder('utf-8').decode(view)
}

/** Converte corpo de erro (JSON, string, ArrayBuffer de download PDF/XML) em objeto/string. */
function normalizarCorpoErro(dados: unknown): CorpoErroApi | string | null {
  if (dados == null) return null
  if (typeof dados === 'string') {
    const t = dados.trim()
    if (!t) return null
    if (t.startsWith('{')) {
      try {
        return JSON.parse(t) as CorpoErroApi
      } catch {
        return t
      }
    }
    return t
  }
  if (typeof dados === 'object') {
    if (dados instanceof ArrayBuffer || ArrayBuffer.isView(dados)) {
      return normalizarCorpoErro(textoDeBuffer(dados as ArrayBuffer | ArrayBufferView))
    }
    // Blob.text() é async — o interceptor em api.ts já parseia JSON de download.
    if (typeof Blob !== 'undefined' && dados instanceof Blob) {
      return null
    }
    const obj = dados as CorpoErroApi & Record<string, unknown>
    if (typeof obj.mensagem === 'string' || typeof obj.message === 'string') return obj
  }
  return null
}

export function extrairMensagemApi(erro: unknown, mensagemPadrao: string): string {
  if (!erro || typeof erro !== 'object') return mensagemPadrao

  const axiosErro = erro as {
    message?: string
    code?: string
    response?: {
      status?: number
      statusText?: string
      data?: unknown
    }
  }

  const corpo = normalizarCorpoErro(axiosErro.response?.data)
  if (corpo && typeof corpo === 'object') {
    if (corpo.mensagem) return corpo.mensagem
    if (corpo.message) return corpo.message
  }

  // ECONNRESET/socket hang up e 500 sem corpo estruturado (ex.: página de erro
  // genérica do proxy do Next) devem usar a mensagem amigável abaixo, mesmo
  // quando o corpo da resposta é uma string curta como "Internal Server Error" —
  // por isso essas checagens vêm antes do fallback de string genérica.
  if (
    axiosErro.code === 'ECONNRESET' ||
    axiosErro.message?.toLowerCase().includes('socket hang up')
  ) {
    return 'A API interrompeu a operação antes de responder. Verifique o terminal da API e tente novamente.'
  }

  const status = axiosErro.response?.status
  if (status === 401) return 'Sessão expirada. Faça login novamente.'
  if (status === 403) return 'Sem permissão para realizar esta ação.'
  if (status === 404) {
    return mensagemPadrao || 'Não encontramos o item solicitado. Atualize a página e tente novamente.'
  }
  if (status === 502 || status === 503) {
    return mensagemPadrao || 'Serviço indisponível. Tente novamente em instantes.'
  }
  if (status === 500) {
    return 'A API interrompeu a operação antes de responder. Verifique o terminal da API e tente novamente.'
  }

  if (typeof corpo === 'string' && corpo.trim() && corpo.length <= 300) {
    return corpo
  }

  if (status) {
    return `Erro ${status}: ${axiosErro.response?.statusText || mensagemPadrao}`
  }

  if (
    axiosErro.code === 'ERR_NETWORK' ||
    axiosErro.message?.toLowerCase().includes('network error')
  ) {
    return 'Não foi possível conectar à API. Verifique se o servidor está rodando.'
  }

  if (axiosErro.message) return axiosErro.message

  return mensagemPadrao
}
