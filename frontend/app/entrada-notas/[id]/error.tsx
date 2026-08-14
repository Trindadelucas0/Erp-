'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TituloPagina } from '@/components/ui/titulo-pagina'

/**
 * Boundary de erro do detalhe — evita a tela genérica do Next
 * ("Application error: a client-side exception…") sem mensagem útil.
 */
export default function ErroDetalheEntradaNota({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[entrada-notas/detalhe]', error)
  }, [error])

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <TituloPagina>Não foi possível abrir a nota</TituloPagina>
      <p className="text-sm text-muted-foreground">
        Ocorreu um erro ao carregar o detalhe. Tente de novo; se persistir após um deploy
        recente, faça um refresh completo da página (Ctrl+F5) para limpar cache de scripts.
      </p>
      {error.message ? (
        <p className="break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs text-destructive">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={reset}>
          Tentar de novo
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href="/entrada-notas">Voltar à lista</Link>
        </Button>
      </div>
    </div>
  )
}
