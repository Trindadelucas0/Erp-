'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginaPapeis() {
  return <RedirectParaConfiguracoesGeralPapeis />
}

function RedirectParaConfiguracoesGeralPapeis() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/configuracoes?aba=geral&secao=papeis')
  }, [router])
  return (
    <p className="text-sm text-muted-foreground">Redirecionando para Configurações…</p>
  )
}
