/**
 * Primitivos de layout estável para modais com formulários dinâmicos.
 *
 * Checklist de adoção em novos modais:
 * 1. Usar `descricao` no componente Modal
 * 2. `ModalFaixaErro` no topo do form (reserva espaço fixo)
 * 3. `ModalPainelResumo` para previews/API assíncrona
 * 4. `ModalSecao` para agrupar campos com título numerado
 * 5. `ModalConfiguracoesAvancadas` para opções não essenciais
 * 6. `alturaMinimaConteudo` no Modal quando criar/editar têm alturas diferentes
 */

'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type ModalFaixaErroProps = {
  mensagem?: string
}

export function ModalFaixaErro({ mensagem }: ModalFaixaErroProps) {
  return (
    <div
      className={cn(
        'min-h-[2.5rem] rounded-md px-3 py-2 text-sm',
        mensagem ? 'bg-destructive/10 text-destructive' : 'invisible',
        !mensagem && 'pointer-events-none select-none'
      )}
      role={mensagem ? 'alert' : undefined}
      aria-hidden={!mensagem}
      aria-live="polite"
    >
      {mensagem || '\u00A0'}
    </div>
  )
}

type ModalPainelResumoProps = {
  carregando?: boolean
  opaco?: boolean
  children?: ReactNode
}

export function ModalPainelResumo({ carregando, opaco, children }: ModalPainelResumoProps) {
  return (
    <div
      className={cn(
        'flex min-h-[4.5rem] flex-col justify-center rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm',
        opaco && !carregando && 'opacity-50'
      )}
    >
      {carregando ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        children
      )}
    </div>
  )
}

type ModalSecaoProps = {
  numero?: number
  titulo: string
  descricao?: string
  children: ReactNode
  className?: string
}

export function ModalSecao({ numero, titulo, descricao, children, className }: ModalSecaoProps) {
  const tituloCompleto = numero != null ? `${numero}. ${titulo}` : titulo

  return (
    <section className={cn('space-y-3', className)}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{tituloCompleto}</h3>
        {descricao && (
          <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        )}
      </div>
      {children}
    </section>
  )
}

type ModalConfiguracoesAvancadasProps = {
  abertoPorPadrao?: boolean
  children: ReactNode
}

export function ModalConfiguracoesAvancadas({
  abertoPorPadrao = false,
  children,
}: ModalConfiguracoesAvancadasProps) {
  const [aberto, setAberto] = useState(abertoPorPadrao)

  useEffect(() => {
    if (abertoPorPadrao) {
      setAberto(true)
    }
  }, [abertoPorPadrao])

  return (
    <details
      className="group rounded-md border border-border"
      open={aberto}
      onToggle={(e) => setAberto(e.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          Opções avançadas
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">
            Mostrar
          </span>
          <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">
            Ocultar
          </span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-border px-3 py-3">{children}</div>
    </details>
  )
}
