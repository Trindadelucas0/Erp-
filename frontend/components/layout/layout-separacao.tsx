'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { textoVersaoSistema } from '@/lib/versao-sistema'
import { cn } from '@/lib/utils'

const ITENS = [
  { rotulo: 'Início', href: '/inicio' },
  { rotulo: 'Separação', href: '/separacao' },
  { rotulo: 'Conferência', href: '/requisicoes?tipo=conferencia' },
  { rotulo: 'Reposição', href: '/requisicoes?tipo=reposicao' },
  { rotulo: 'Movimentações', href: '/requisicoes?tipo=movimentacao' },
  { rotulo: 'Inventário', href: '/requisicoes?tipo=inventario' },
  { rotulo: 'Cadastros', href: '/enderecos-wms' },
] as const

function itemAtivo(caminho: string, href: string) {
  if (href === '/separacao') return caminho === '/separacao' || caminho.startsWith('/separacao/')
  return caminho === href
}

function MenuSeparacao({
  caminho,
  aoNavegar,
}: {
  caminho: string
  aoNavegar?: () => void
}) {
  return (
    <nav className="flex h-full flex-col border-r border-border bg-card">
      <div className="shrink-0 border-b border-border px-4 py-4">
        <h1 className="pl-2 text-lg font-bold tracking-tight text-primary">WMS</h1>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {ITENS.map((item) => {
          const ativo = itemAtivo(caminho, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={aoNavegar}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  ativo
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="shrink-0 border-t border-border px-6 py-4 text-xs text-muted-foreground">
        {textoVersaoSistema()}
      </p>
    </nav>
  )
}

type Props = {
  children: React.ReactNode
}

export function LayoutSeparacao({ children }: Props) {
  const caminho = usePathname() ?? ''
  const { perfil } = useSessaoDoUsuario()
  const [menuAberto, setMenuAberto] = useState(false)
  const papel = perfil?.usuario.roles?.[0]?.role.name

  return (
    <div className="flex min-h-screen min-w-0 bg-background">
      <aside className="hidden w-56 shrink-0 print:hidden md:block">
        <div className="sticky top-0 h-screen">
          <MenuSeparacao caminho={caminho} />
        </div>
      </aside>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="left" showCloseButton={false} className="w-64 gap-0 p-0">
          <SheetTitle className="sr-only">Menu da separação</SheetTitle>
          <MenuSeparacao caminho={caminho} aoNavegar={() => setMenuAberto(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border px-3 print:hidden md:px-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuAberto(true)}
            >
              <Menu className="size-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
            <p className="text-sm font-semibold">Separação de pedidos</p>
          </div>
          {perfil ? (
            <p className="truncate text-right text-sm">
              <span className="font-medium">{perfil.usuario.name}</span>
              {papel ? <span className="text-muted-foreground"> · {papel}</span> : null}
            </p>
          ) : null}
        </header>
        <main className="min-w-0 flex-1 p-3 md:p-4">{children}</main>
      </div>
    </div>
  )
}
