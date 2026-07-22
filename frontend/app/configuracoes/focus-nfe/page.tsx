'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginaFocusNfe() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/configuracoes?aba=fiscal&secao=buscador')
  }, [router])
  return (
    <p className="text-sm text-muted-foreground">Redirecionando para Configurações…</p>
  )
}
