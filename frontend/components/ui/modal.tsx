'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

type Largura = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const larguras: Record<Largura, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

type Props = {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  descricao?: string
  largura?: Largura
  children: ReactNode
  rodape?: ReactNode
}

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  largura = 'lg',
  children,
  rodape,
}: Props) {
  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar()
      }}
    >
      <div
        className={`flex w-full flex-col ${larguras[largura]} max-h-[90vh] rounded-lg border border-border bg-card shadow-xl`}
      >
        {/* Cabeçalho fixo */}
        <div className="flex shrink-0 items-start justify-between border-b border-border px-6 py-4">
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold leading-none">{titulo}</h2>
            {descricao && (
              <p className="text-sm text-muted-foreground">{descricao}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-4 h-8 w-8 shrink-0 p-0"
            onClick={aoFechar}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Rodapé fixo (opcional) */}
        {rodape && (
          <div className="shrink-0 border-t border-border px-6 py-4">
            {rodape}
          </div>
        )}
      </div>
    </div>
  )
}
