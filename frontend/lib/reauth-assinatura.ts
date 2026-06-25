/**
 * Gerencia o token de reautenticação para a seção de documentos de assinatura.
 * Armazena em sessionStorage para que expire automaticamente ao fechar a aba.
 */

const CHAVE_TOKEN = 'reauth_assinatura_token'
const CHAVE_EXPIRA_EM = 'reauth_assinatura_expira_em'

export function salvarTokenReauth(token: string, expiraEm: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(CHAVE_TOKEN, token)
  sessionStorage.setItem(CHAVE_EXPIRA_EM, expiraEm)
}

export function obterTokenReauth(): string | null {
  if (typeof window === 'undefined') return null
  const token = sessionStorage.getItem(CHAVE_TOKEN)
  const expiraEm = sessionStorage.getItem(CHAVE_EXPIRA_EM)
  if (!token || !expiraEm) return null
  if (new Date() >= new Date(expiraEm)) {
    limparTokenReauth()
    return null
  }
  return token
}

export function limparTokenReauth(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(CHAVE_TOKEN)
  sessionStorage.removeItem(CHAVE_EXPIRA_EM)
}

export function estaDesbloqueado(): boolean {
  return obterTokenReauth() !== null
}
