'use client'

import { usePathname } from 'next/navigation'
import { LayoutPrincipal } from '@/components/layout/layout-principal'

const ROTAS_SEM_LAYOUT = ['/login']
const PREFIXOS_SEM_LAYOUT = ['/portal-fornecedor']

type Props = {
  children: React.ReactNode
}

export function LayoutCondicional({ children }: Props) {
  const caminho = usePathname()
  const semLayout =
    ROTAS_SEM_LAYOUT.includes(caminho) ||
    PREFIXOS_SEM_LAYOUT.some((prefixo) => caminho.startsWith(prefixo))

  if (semLayout) {
    return <>{children}</>
  }

  return <LayoutPrincipal>{children}</LayoutPrincipal>
}
