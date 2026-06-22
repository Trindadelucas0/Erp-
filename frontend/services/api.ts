/**
 * Cliente HTTP — envia token JWT e empresa ativa em cada requisição.
 * Interceptor de resposta redireciona ao login em caso de token expirado.
 */
import axios from 'axios'
import { limparSessaoLocal } from '@/lib/sessao-local'

const URL_DA_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

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
  }
  return configuracao
})

clienteHttp.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    if (
      typeof window !== 'undefined' &&
      erro.response?.status === 401 &&
      !window.location.pathname.includes('/login') &&
      !window.location.pathname.startsWith('/assinatura')
    ) {
      limparSessaoLocal()
      window.location.href = '/login'
    }
    return Promise.reject(erro)
  }
)
