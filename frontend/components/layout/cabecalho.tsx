'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TITULOS_POR_ROTA: Record<string, string> = {
  '/login': 'Login',
  '/inicio': 'Início',
  '/cadastros': 'Cadastros',
  '/users': 'Usuários',
  '/papeis': 'Gerenciar papéis',
}

type Props = {
  titulo?: string
  acoes?: React.ReactNode
  aoAbrirMenuMobile?: () => void
}

export function Cabecalho({ titulo, acoes, aoAbrirMenuMobile }: Props) {
  const caminhoAtual = usePathname()
  const tituloExibido = titulo ?? TITULOS_POR_ROTA[caminhoAtual] ?? 'ERP PRÓPRIO'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={aoAbrirMenuMobile}
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </Button>
        <h2 className="text-lg font-semibold tracking-tight">{tituloExibido}</h2>
      </div>
      {acoes && <div className="flex items-center gap-2">{acoes}</div>}
    </header>
  )
}
