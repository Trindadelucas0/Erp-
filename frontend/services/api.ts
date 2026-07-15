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

clienteHttp.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    if (typeof window !== 'undefined') {
      if (
        erro.response?.status === 401 &&
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
