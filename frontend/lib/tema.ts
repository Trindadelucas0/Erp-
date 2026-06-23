export type TemaDoSistema = 'claro' | 'escuro'

export const COOKIE_TEMA = 'erp-tema'
export const TEMA_PADRAO: TemaDoSistema = 'escuro'

export function aplicarTemaNoDocumento(tema: TemaDoSistema) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', tema === 'escuro')
}

export function salvarTemaNoCookie(tema: TemaDoSistema) {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_TEMA}=${tema};path=/;max-age=31536000;SameSite=Lax`
}

export function lerTemaDoCookie(): TemaDoSistema | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_TEMA}=([^;]*)`))
  const valor = match?.[1]
  return valor === 'claro' || valor === 'escuro' ? valor : null
}

export function temaDoUsuario(
  tema?: string | null
): TemaDoSistema {
  return tema === 'claro' ? 'claro' : TEMA_PADRAO
}
