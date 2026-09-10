'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginaUsuarios() {
  return <RedirectParaConfiguracoesGeralUsuarios />
}

function RedirectParaConfiguracoesGeralUsuarios() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/configuracoes?aba=geral&secao=usuarios')
  }, [router])
  return (
    <p className="text-sm text-muted-foreground">Redirecionando para Configurações…</p>
  )
}
