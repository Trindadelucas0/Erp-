'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  classeUrgenciaPendencia,
  type ItemPendencia,
} from '@/lib/pendencias'
import { cn } from '@/lib/utils'

type Props = {
  itens: ItemPendencia[]
  total: number
  tela: string
  ocultos: Set<string>
  aoFechar: (id: string) => void
}

export function DockPendencias({ itens, total, tela, ocultos, aoFechar }: Props) {
  const visiveis = itens.filter((i) => !ocultos.has(i.id)).slice(0, 3)
  if (visiveis.length === 0) return null

  const restantes = Math.max(0, total - visiveis.length)

  return (
    <div
      role="region"
      aria-label="Pendências desta tela"
      className="pointer-events-none fixed bottom-3 left-3 z-40 flex w-[min(100vw-1.5rem,20rem)] flex-col-reverse gap-2"
    >
      {restantes > 0 && (
        <div className="pointer-events-auto">
          <Link
            href={`/pendencias?tela=${encodeURIComponent(tela)}`}
            className="block rounded-md border-2 border-border bg-card px-3 py-2 text-center text-xs font-medium text-primary shadow-md hover:bg-muted"
          >
            Ver todas ({total})
          </Link>
        </div>
      )}
      {visiveis.map((item) => (
        <Card
          key={item.id}
          size="sm"
          className={cn(
            'pointer-events-auto animate-in fade-in slide-in-from-bottom-2 border-2 shadow-md duration-200',
            classeUrgenciaPendencia(item.urgencia)
          )}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-1">
            <CardTitle className="line-clamp-2 text-sm leading-snug">
              <Link href={item.href} className="hover:underline">
                {item.titulo}
              </Link>
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label="Fechar pendência nesta visita"
              onClick={() => aoFechar(item.id)}
            >
              <X className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="line-clamp-2 text-xs text-muted-foreground">{item.descricao}</p>
            <Link
              href={item.href}
              className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline"
            >
              Abrir
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
