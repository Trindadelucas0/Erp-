'use client'

import {
  FORMAS_TOTEM_TOUCH,
  rotuloFormaTotemTouch,
  type FormaTotemTouch,
} from '@/lib/receber-pagamento-totem'
import { cn } from '@/lib/utils'

type Props = {
  formaAtiva: FormaTotemTouch
  creditoDisponivel: boolean
  disabled?: boolean
  onSelecionar: (forma: FormaTotemTouch) => void
}

export function GradeFormasTotem({
  formaAtiva,
  creditoDisponivel,
  disabled,
  onSelecionar,
}: Props) {
  return (
    <div className="grid gap-3">
      {FORMAS_TOTEM_TOUCH.map((forma) => {
        const bloqueado = forma === 'cartao_credito' && !creditoDisponivel
        const selecionado = formaAtiva === forma
        return (
          <button
            key={forma}
            type="button"
            disabled={disabled || bloqueado}
            onClick={() => onSelecionar(forma)}
            className={cn(
              'flex min-h-[120px] flex-col items-center justify-center rounded-2xl border-2 px-4 py-5 text-center transition-colors touch-manipulation',
              selecionado
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground',
              bloqueado && 'cursor-not-allowed opacity-50'
            )}
          >
            <span className="text-xl font-bold">{rotuloFormaTotemTouch(forma)}</span>
            {bloqueado ? (
              <span className="mt-2 text-sm opacity-90">Cadastre cartões em Configurações</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
