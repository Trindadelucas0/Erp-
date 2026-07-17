'use client'

import { useState } from 'react'
import { BarraLateral } from '@/components/layout/barra-lateral'
import { Cabecalho } from '@/components/layout/cabecalho'
import { ProvedorDeAtalhos } from '@/components/compartilhado/provedor-de-atalhos'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'

type Props = {
  children: React.ReactNode
}

export function LayoutPrincipal({ children }: Props) {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)

  return (
    <ProvedorDeAtalhos>
    <div className="flex min-h-screen min-w-0 overflow-x-hidden bg-background">
      <div className="hidden md:flex">
        <BarraLateral className="fixed inset-y-0 left-0 z-30" />
      </div>

      <Sheet open={menuMobileAberto} onOpenChange={setMenuMobileAberto}>
        <SheetContent side="left" className="h-full w-64 max-w-[85vw] p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <BarraLateral
            className="h-full"
            aoFecharMenuMobile={() => setMenuMobileAberto(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden md:pl-64">
        <Cabecalho aoAbrirMenuMobile={() => setMenuMobileAberto(true)} />
        <main className="min-w-0 flex-1 p-3 md:p-4">
          <div className="mx-auto w-full min-w-0 max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
    </ProvedorDeAtalhos>
  )
}
