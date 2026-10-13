'use client'

import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { TelaFluxoDeCaixa } from '@/components/conciliacao-bancaria/telas-consulta-financeira'

export default function PaginaFluxoDeCaixa() {
  return <ProtegerRota chaveDaPagina="fluxo-de-caixa"><TelaFluxoDeCaixa /></ProtegerRota>
}
