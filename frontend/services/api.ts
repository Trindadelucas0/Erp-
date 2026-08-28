/**
 * Cliente HTTP — envia token JWT e empresa ativa em cada requisição.
 * Interceptor de resposta redireciona ao login em caso de token expirado.
 */
import axios from 'axios'
import { limparSessaoLocal } from '@/lib/sessao-local'
import { obterTokenReauth, limparTokenReauth } from '@/lib/reauth-assinatura'

const URL_DA_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

export { URL_DA_API }

export const clienteHttp = axios.create({
  baseURL: URL_DA_API,
})

clienteHttp.interceptors.request.use((configuracao) => {
  if (typeof window !== 'undefined') {
    const tokenSalvo = localStorage.getItem('token')
    if (tokenSalvo) {
      configuracao.headers.Authorization = `Bearer ${tokenSalvo}`
    }

    const empresaAtivaId = localStorage.getItem('empresaAtivaId')
    if (empresaAtivaId) {
      configuracao.headers['X-Company-Id'] = empresaAtivaId
    }

    // Anexa token de reautenticação em rotas de documentos de assinatura
    if (configuracao.url?.includes('/zapsign/documentos')) {
      const tokenReauth = obterTokenReauth()
      if (tokenReauth) {
        configuracao.headers['X-Reauth-Token'] = tokenReauth
      }
    }
  }
  return configuracao
})

/** Em downloads (blob/arraybuffer) o corpo de erro JSON vem binário — parseia para { mensagem }. */
async function normalizarCorpoErroBinario(erro: {
  response?: { data?: unknown }
}): Promise<void> {
  const data = erro.response?.data
  if (data == null || !erro.response) return

  let texto: string | null = null
  if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
    texto = new TextDecoder('utf-8').decode(data)
  } else if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(data)) {
    texto = new TextDecoder('utf-8').decode(data as ArrayBufferView)
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    texto = await data.text()
  }
  if (!texto?.trim().startsWith('{')) return
  try {
    erro.response.data = JSON.parse(texto)
  } catch {
    /* mantém binário */
  }
}

function extrairMensagemErroResposta(data: unknown): string {
  if (data == null) return ''
  if (typeof data === 'object' && data !== null && 'mensagem' in data) {
    return String((data as { mensagem?: string }).mensagem ?? '')
  }
  if (typeof data === 'string') {
    const t = data.trim()
    if (t.startsWith('{')) {
      try {
        return String((JSON.parse(t) as { mensagem?: string }).mensagem ?? '')
      } catch {
        return t
      }
    }
    return t
  }
  return ''
}

/** 401 da Focus (token/ambiente) não deve deslogar o usuário do ERP. */
function erro401IndicaSessaoExpirada(erro: { response?: { data?: unknown } }): boolean {
  const mensagem = extrairMensagemErroResposta(erro.response?.data).toLowerCase()
  if (!mensagem) return true
  if (
    mensagem.includes('focus') ||
    mensagem.includes('nfe recebidas') ||
    mensagem.includes('ambiente homolog') ||
    mensagem.includes('ambiente produc') ||
    mensagem.includes('baixar o pdf na focus') ||
    mensagem.includes('obter o xml')
  ) {
    return false
  }
  return (
    mensagem.includes('sessão') ||
    mensagem.includes('sessao') ||
    mensagem.includes('token inválido ou expirado') ||
    mensagem.includes('token invalido ou expirado') ||
    mensagem.includes('usuário inativo') ||
    mensagem.includes('usuario inativo') ||
    mensagem.includes('não autenticado') ||
    mensagem.includes('nao autenticado')
  )
}

clienteHttp.interceptors.response.use(
  (resposta) => resposta,
  async (erro) => {
    await normalizarCorpoErroBinario(erro)

    if (typeof window !== 'undefined') {
      if (
        erro.response?.status === 401 &&
        erro401IndicaSessaoExpirada(erro) &&
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.startsWith('/assinatura') &&
        !window.location.pathname.startsWith('/portal-fornecedor')
      ) {
        limparSessaoLocal()
        window.location.href = '/login'
      }

      // Token de reauth expirado ou inválido — força novo desbloqueio na UI
      if (
        erro.response?.status === 403 &&
        typeof erro.response?.data?.mensagem === 'string' &&
        erro.response.data.mensagem.includes('Confirme sua senha de administrador')
      ) {
        limparTokenReauth()
      }
    }
    return Promise.reject(erro)
  }
)
