/**
 * URL pública do frontend (link de assinatura, etc.).
 * Em produção, defina NEXT_PUBLIC_APP_URL no .env.production.
 */
export function urlPublicaDoApp(): string {
  const daEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (daEnv) return daEnv
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function montarLinkDeAssinatura(token: string): string {
  return `${urlPublicaDoApp()}/assinatura/${token}`
}
