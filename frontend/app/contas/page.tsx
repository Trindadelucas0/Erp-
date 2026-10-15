'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'

function RedirectParaConfiguracoesContas() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/configuracoes?aba=financeiro&secao=contas')
  }, [router])
  return <p className="text-sm text-muted-foreground">Redirecionando para Configurações…</p>
}

export default function PaginaContas() {
  return (
    <ProtegerRota chaveDaPagina="contas">
      <RedirectParaConfiguracoesContas />
    </ProtegerRota>
  )
}
