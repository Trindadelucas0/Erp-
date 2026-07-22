'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginaPlanosFinanceiros() {
  return <RedirectParaConfiguracoesFinanceiro />
}

function RedirectParaConfiguracoesFinanceiro() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/configuracoes?aba=financeiro')
  }, [router])
  return (
    <p className="text-sm text-muted-foreground">Redirecionando para Configurações…</p>
  )
}
