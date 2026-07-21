'use client'

import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { PainelConfiguracaoFocusNfe } from '@/components/focus-nfe/painel-configuracao-focus-nfe'

function Conteudo() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Focus NFe</h1>
        <p className="text-sm text-muted-foreground">
          Token e ambiente para NFe recebidas (manifestador) — Entrada de Notas
        </p>
      </div>
      <PainelConfiguracaoFocusNfe />
    </div>
  )
}

export default function PaginaFocusNfe() {
  return (
    <ProtegerRota somenteAdmin>
      <Conteudo />
    </ProtegerRota>
  )
}
