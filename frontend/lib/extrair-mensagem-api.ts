/**
 * Extrai mensagem legível de erros retornados pela API (Axios) ou da rede.
 * O backend retorna { mensagem } nos erros controlados — este helper garante
 * que o frontend sempre mostre a causa real, nunca um texto genérico.
 */
export function extrairMensagemApi(erro: unknown, mensagemPadrao: string): string {
  if (!erro || typeof erro !== 'object') return mensagemPadrao

  const axiosErro = erro as {
    message?: string
    code?: string
    response?: {
      status?: number
      statusText?: string
      data?: { mensagem?: string; message?: string } | string
    }
  }

  const dados = axiosErro.response?.data

  if (dados && typeof dados === 'object') {
    if (dados.mensagem) return dados.mensagem
    if (dados.message) return dados.message
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
    return 'Servidor ZapSign indisponível. Tente novamente em instantes.'
  }
  if (status === 500) {
    return 'A API interrompeu a operação antes de responder. Verifique o terminal da API e tente novamente.'
  }

  if (typeof dados === 'string' && dados.trim() && dados.length <= 300) {
    return dados
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
