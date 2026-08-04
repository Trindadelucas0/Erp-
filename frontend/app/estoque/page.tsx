'use client'

import { Suspense } from 'react'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { TelaKardexEstoque } from '@/components/estoque/tela-kardex-estoque'

export default function PaginaEstoque() {
  return (
    <ProtegerRota chaveDaPagina="estoque">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <TelaKardexEstoque />
      </Suspense>
    </ProtegerRota>
  )
}
