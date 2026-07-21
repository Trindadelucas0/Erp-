'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

type Props = {
  ativo: boolean
  rotulo: string
}

/**
 * Barra de feedback durante Ver nota / Baixar XML / Baixar PDF.
 * Progresso indeterminado (sobe até ~90%) e completa ao encerrar a request.
 */
export function BarraCarregamentoDownload({ ativo, rotulo }: Props) {
  const [visivel, setVisivel] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [texto, setTexto] = useState(rotulo)
  const visivelRef = useRef(false)

  useEffect(() => {
    visivelRef.current = visivel
  }, [visivel])

  useEffect(() => {
    if (ativo) {
      setTexto(rotulo || 'Carregando…')
      setVisivel(true)
      setProgresso(8)
      return
    }
    if (!visivelRef.current) return
    setProgresso(100)
    const t = setTimeout(() => {
      setVisivel(false)
      setProgresso(0)
    }, 300)
    return () => clearTimeout(t)
  }, [ativo, rotulo])

  useEffect(() => {
    if (!ativo || !visivel) return
    const intervalo = setInterval(() => {
      setProgresso((atual) => {
        if (atual >= 90) return atual
        return Math.min(90, atual + (atual < 50 ? 6 : atual < 75 ? 2 : 1))
      })
    }, 280)
    return () => clearInterval(intervalo)
  }, [ativo, visivel])

  if (!visivel) return null

  return (
    <div
      className="sticky top-0 z-40 -mx-1 mb-2 rounded-md border border-border bg-background/95 px-3 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
      role="status"
      aria-live="polite"
      aria-busy={ativo}
    >
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{texto}</p>
        <span className="tabular-nums text-xs text-muted-foreground">{Math.round(progresso)}%</span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(progresso)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={texto}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${progresso}%` }}
        />
      </div>
    </div>
  )
}
