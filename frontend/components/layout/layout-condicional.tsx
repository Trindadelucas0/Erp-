'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const LayoutPrincipal = dynamic(
  () =>
    import('@/components/layout/layout-principal').then((mod) => ({
      default: mod.LayoutPrincipal,
    })),
  { ssr: false }
)

const ROTAS_SEM_LAYOUT = ['/login']
const PREFIXOS_SEM_LAYOUT = ['/portal-fornecedor']

type Props = {
  children: React.ReactNode
}

export function LayoutCondicional({ children }: Props) {
  const caminho = usePathname()
  const semLayout =
    Boolean(caminho) &&
    (ROTAS_SEM_LAYOUT.includes(caminho) ||
      PREFIXOS_SEM_LAYOUT.some((prefixo) => caminho.startsWith(prefixo)))

  if (semLayout) {
    return <>{children}</>
  }

  return <LayoutPrincipal>{children}</LayoutPrincipal>
}
