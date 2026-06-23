'use client'

import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'

type Props = {
  aberto: boolean
  titulo?: string
  mensagem?: string
  textoConfirmar?: string
  textoCancelar?: string
  aoConfirmar: () => void
  aoCancelar: () => void
}

export function ModalConfirmacao({
  aberto,
  titulo = 'Sair sem salvar?',
  mensagem = 'Tem certeza que deseja sair? As alterações não salvas serão perdidas.',
  textoConfirmar = 'Sair sem salvar',
  textoCancelar = 'Continuar editando',
  aoConfirmar,
  aoCancelar,
}: Props) {
  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoCancelar()
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
        role="alertdialog"
        aria-labelledby="modal-confirmacao-titulo"
        aria-describedby="modal-confirmacao-mensagem"
      >
        <h2 id="modal-confirmacao-titulo" className="text-lg font-semibold">
          {titulo}
        </h2>
        <p id="modal-confirmacao-mensagem" className="mt-2 text-sm text-muted-foreground">
          {mensagem}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={aoCancelar}>
            {textoCancelar}
          </Button>
          <BotaoPrimario type="button" variant="destructive" onClick={aoConfirmar}>
            {textoConfirmar}
          </BotaoPrimario>
        </div>
      </div>
    </div>
  )
}
