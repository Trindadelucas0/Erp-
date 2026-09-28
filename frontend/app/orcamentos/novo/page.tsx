'use client'

import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { FormularioOrcamentoLayout } from '@/components/orcamentos/formulario-orcamento-layout'

export default function PaginaNovoOrcamento() {
  return (
    <ProtegerRota chaveDaPagina="orcamentos">
      <FormularioOrcamentoLayout />
    </ProtegerRota>
  )
}
