'use client'

import type { ReactNode } from 'react'
import { BotaoPrimario } from '@/components/ui/botao-primario'

type Props = {
  aberto: boolean
  titulo?: string
  mensagem?: string
  children?: ReactNode
  textoConfirmar?: string
  aoConfirmar: () => void
}

/** Modal de ciência (só OK) — backdrop e Escape também confirmam. */
export function ModalCiencia({
  aberto,
  titulo = 'Atenção',
  mensagem = '',
  children,
  textoConfirmar = 'Entendi',
  aoConfirmar,
}: Props) {
  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoConfirmar()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') aoConfirmar()
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-amber-300 bg-card p-6 shadow-xl dark:border-amber-800/60"
        role="alertdialog"
        aria-labelledby="modal-ciencia-titulo"
        aria-describedby="modal-ciencia-mensagem"
      >
        <h2 id="modal-ciencia-titulo" className="text-lg font-semibold text-amber-900 dark:text-amber-200">
          {titulo}
        </h2>
        {children ? (
          <div id="modal-ciencia-mensagem" className="mt-2 text-sm text-muted-foreground">
            {children}
          </div>
        ) : (
          <p
            id="modal-ciencia-mensagem"
            className="mt-2 whitespace-pre-line text-sm text-muted-foreground"
          >
            {mensagem}
          </p>
        )}
        <div className="mt-6 flex justify-end">
          <BotaoPrimario type="button" onClick={aoConfirmar}>
            {textoConfirmar}
          </BotaoPrimario>
        </div>
      </div>
    </div>
  )
}
