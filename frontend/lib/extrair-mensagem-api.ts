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

  if (typeof dados === 'string' && dados.trim() && dados.length <= 300) {
    return dados
  }

  const status = axiosErro.response?.status
  if (status === 401) return 'Sessão expirada. Faça login novamente.'
  if (status === 403) return 'Sem permissão para realizar esta ação.'
  if (status === 404) {
    return 'Rota da API não encontrada. Reinicie o servidor backend (npm run dev).'
  }
  if (status === 502 || status === 503) {
    return 'Servidor ZapSign indisponível. Tente novamente em instantes.'
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
