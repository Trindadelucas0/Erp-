'use client'

import { useEffect, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Largura = 'sm' | 'md' | 'lg' | 'xl' | '2xl'
type AlturaMinimaConteudo = 'sm' | 'md' | 'lg'

const larguras: Record<Largura, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

const alturasMinimasConteudo: Record<AlturaMinimaConteudo, string> = {
  sm: 'min-h-[20rem]',
  md: 'min-h-[28rem]',
  lg: 'min-h-[36rem]',
}

type Props = {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  /** Texto curto abaixo do título — orienta usuários iniciantes sem alterar altura do modal. */
  descricao?: string
  largura?: Largura
  children: ReactNode
  rodape?: ReactNode
  cabecalhoExtra?: ReactNode
  /**
   * Altura mínima do corpo rolável. Use `sm` | `md` | `lg` ou uma classe Tailwind (ex.: `min-h-[420px]`).
   * Combine com ModalFaixaErro e ModalPainelResumo em formulários assíncronos.
   */
  alturaMinimaConteudo?: AlturaMinimaConteudo | string
  manterPosicao?: boolean
}

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  largura = 'lg',
  children,
  rodape,
  cabecalhoExtra,
  alturaMinimaConteudo,
  manterPosicao = false,
}: Props) {
  useEffect(() => {
    if (!aberto) return

    function aoPressionarEsc(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        aoFechar()
      }
    }

    document.addEventListener('keydown', aoPressionarEsc, true)
    return () => document.removeEventListener('keydown', aoPressionarEsc, true)
  }, [aberto, aoFechar])

  if (!aberto) return null

  const classeAlturaMinima =
    alturaMinimaConteudo &&
    (alturaMinimaConteudo in alturasMinimasConteudo
      ? alturasMinimasConteudo[alturaMinimaConteudo as AlturaMinimaConteudo]
      : alturaMinimaConteudo)

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center bg-black/60 p-4',
        manterPosicao ? 'items-start pt-[8vh]' : 'items-center'
      )}
    >
      <div
        className={cn(
          'flex w-full flex-col',
          larguras[largura],
          'max-h-[90vh] rounded-lg border border-border bg-card shadow-xl'
        )}
      >
        {/* Cabeçalho fixo */}
        <div className="flex shrink-0 items-start justify-between border-b border-border px-6 py-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <h2 className="text-lg font-semibold leading-none">{titulo}</h2>
            {descricao && (
              <p className="text-sm text-muted-foreground">{descricao}</p>
            )}
            {cabecalhoExtra}
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
        <div
          className={cn(
            'flex-1 overflow-x-hidden overflow-y-auto px-6 py-4',
            alturaMinimaConteudo && classeAlturaMinima
          )}
        >
          {children}
        </div>

        {/* Rodapé fixo (opcional) */}
        {rodape && (
          <div className="shrink-0 border-t border-border px-6 py-4">{rodape}</div>
        )}
      </div>
    </div>
  )
}
