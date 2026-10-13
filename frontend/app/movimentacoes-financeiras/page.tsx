'use client'

import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { TelaMovimentacoesFinanceiras } from '@/components/conciliacao-bancaria/telas-consulta-financeira'

export default function PaginaMovimentacoesFinanceiras() {
  return <ProtegerRota chaveDaPagina="movimentacoes-financeiras"><TelaMovimentacoesFinanceiras /></ProtegerRota>
}
