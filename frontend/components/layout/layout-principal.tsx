'use client'

import { useState } from 'react'
import { BarraLateral } from '@/components/layout/barra-lateral'
import { Cabecalho } from '@/components/layout/cabecalho'
import { ProvedorDeAtalhos } from '@/components/compartilhado/provedor-de-atalhos'
import { ProvedorPendencias } from '@/components/pendencias/provedor-pendencias'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'

type Props = {
  children: React.ReactNode
}

export function LayoutPrincipal({ children }: Props) {
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <ProvedorDeAtalhos>
    <ProvedorPendencias>
    <div className="flex min-h-screen min-w-0 overflow-x-hidden bg-background">
      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="h-full w-64 max-w-[85vw] gap-0 p-0 sm:max-w-sm"
        >
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <BarraLateral
            className="h-full border-r-0"
            aoFecharMenuMobile={() => setMenuAberto(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
        <Cabecalho aoAbrirMenuMobile={() => setMenuAberto(true)} />
        <main className="min-w-0 flex-1 p-3 md:p-4">
          <div className="mx-auto w-full min-w-0 max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
    </ProvedorPendencias>
    </ProvedorDeAtalhos>
  )
}
