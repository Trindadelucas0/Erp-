'use client'

import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { TelaRelatoriosFinanceiros } from '@/components/conciliacao-bancaria/telas-consulta-financeira'

export default function PaginaRelatoriosFinanceiros() {
  return <ProtegerRota chaveDaPagina="relatorios-financeiros"><TelaRelatoriosFinanceiros /></ProtegerRota>
}
