'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginaEstruturaWms() {
  return <RedirectParaConfiguracoesLogistica />
}

function RedirectParaConfiguracoesLogistica() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/configuracoes?aba=logistica&secao=estrutura')
  }, [router])
  return (
    <p className="text-sm text-muted-foreground">Redirecionando para Configurações…</p>
  )
}
