'use client'

import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  rotuloSalvar: string
  salvando?: boolean
  podeSalvar?: boolean
  aoAnterior?: () => void
  mostrarAnterior?: boolean
  aoProximo?: () => void
  mostrarProximo?: boolean
  rotuloProximo?: string
  podeProximo?: boolean
  desabilitado?: boolean
  formId?: string
  titleSalvar?: string
}

export function RodapeModalFormulario({
  rotuloSalvar,
  salvando = false,
  podeSalvar = true,
  aoAnterior,
  mostrarAnterior = false,
  aoProximo,
  mostrarProximo = false,
  rotuloProximo = 'Próximo →',
  podeProximo = true,
  desabilitado = false,
  formId,
  titleSalvar,
}: Props) {
  const bloqueado = desabilitado || salvando

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex shrink-0 gap-2">
        <BotaoPrimario
          form={formId}
          type="submit"
          disabled={!podeSalvar || bloqueado}
          title={titleSalvar}
        >
          {salvando ? (
            <span className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="31.4"
                  strokeDashoffset="10"
                />
              </svg>
              Salvando...
            </span>
          ) : (
            rotuloSalvar
          )}
        </BotaoPrimario>
        <Button
          type="button"
          variant="outline"
          onClick={aoAnterior}
          disabled={bloqueado}
          className={cn(!mostrarAnterior && 'invisible pointer-events-none')}
          tabIndex={mostrarAnterior ? 0 : -1}
          aria-hidden={!mostrarAnterior}
        >
          ← Anterior
        </Button>
      </div>
      <div className="flex shrink-0 gap-2">
        <BotaoPrimario
          type="button"
          onClick={aoProximo}
          disabled={!podeProximo || bloqueado}
          className={cn(!mostrarProximo && 'invisible pointer-events-none')}
          tabIndex={mostrarProximo ? 0 : -1}
          aria-hidden={!mostrarProximo}
        >
          {rotuloProximo}
        </BotaoPrimario>
      </div>
    </div>
  )
}
