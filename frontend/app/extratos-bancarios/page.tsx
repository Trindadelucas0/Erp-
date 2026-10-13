'use client'

import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { TelaExtratosBancarios } from '@/components/conciliacao-bancaria/telas-consulta-financeira'

export default function PaginaExtratosBancarios() {
  return <ProtegerRota chaveDaPagina="extratos-bancarios"><TelaExtratosBancarios /></ProtegerRota>
}
