'use client'

import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { TelaKardexEstoque } from '@/components/estoque/tela-kardex-estoque'

export default function PaginaEstoque() {
  return (
    <ProtegerRota chaveDaPagina="estoque">
      <TelaKardexEstoque />
    </ProtegerRota>
  )
}
