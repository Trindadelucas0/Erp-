'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginaCfops() {
  return <RedirectParaConfiguracoesFiscal />
}

function RedirectParaConfiguracoesFiscal() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/configuracoes?aba=fiscal&secao=cfop')
  }, [router])
  return (
    <p className="text-sm text-muted-foreground">Redirecionando para Configurações…</p>
  )
}
