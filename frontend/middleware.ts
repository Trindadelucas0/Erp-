/**
 * Middleware Next.js — proteção server-side de rotas.
 * Redireciona para /login se não houver cookie de autenticação.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROTAS_PUBLICAS = ['/login', '/assinatura']

export function middleware(requisicao: NextRequest) {
  const { pathname } = requisicao.nextUrl

  if (ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
    return NextResponse.next()
  }

  const tokenBruto = requisicao.cookies.get('erp_token')?.value
  const token = tokenBruto ? decodeURIComponent(tokenBruto) : undefined

  if (!token) {
    const loginUrl = new URL('/login', requisicao.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
