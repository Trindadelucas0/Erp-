'use client'

import { segmentarTextoPorTermo } from '@/lib/normalizar-busca'

type Props = {
  texto: string
  termo: string
  className?: string
}

export function TextoDestaqueBusca({ texto, termo, className }: Props) {
  const segmentos = segmentarTextoPorTermo(texto, termo)

  return (
    <span className={className}>
      {segmentos.map((segmento, indice) =>
        segmento.destaque ? (
          <strong key={indice} className="font-semibold text-foreground">
            {segmento.texto}
          </strong>
        ) : (
          segmento.texto
        )
      )}
    </span>
  )
}
