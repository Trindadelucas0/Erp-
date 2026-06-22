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
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:flex">
        <BarraLateral className="fixed inset-y-0 left-0 z-30" />
      </div>

      <Sheet open={menuMobileAberto} onOpenChange={setMenuMobileAberto}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <BarraLateral aoFecharMenuMobile={() => setMenuMobileAberto(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen flex-1 flex-col md:pl-64">
        <Cabecalho aoAbrirMenuMobile={() => setMenuMobileAberto(true)} />
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
    </ProvedorDeAtalhos>
  )
}
