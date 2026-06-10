/**
 * Cliente HTTP — envia o token JWT automaticamente em cada requisição.
 */
import axios from 'axios'

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
  }
  return configuracao
})
