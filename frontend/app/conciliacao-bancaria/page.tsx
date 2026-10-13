'use client'

import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { TelaConciliacaoBancaria } from '@/components/conciliacao-bancaria/tela-conciliacao-bancaria'

export default function PaginaConciliacaoBancaria() {
  return (
    <ProtegerRota chaveDaPagina="conciliacao-bancaria">
      <TelaConciliacaoBancaria />
    </ProtegerRota>
  )
}
