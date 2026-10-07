'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginaReceberPagamentoNovo() {
  const roteador = useRouter()

  useEffect(() => {
    roteador.replace('/receber-pagamento')
  }, [roteador])

  return (
    <p className="p-6 text-sm text-muted-foreground">Redirecionando para Receber pagamento…</p>
  )
}
