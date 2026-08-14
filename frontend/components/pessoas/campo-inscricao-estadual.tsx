'use client'

import { classesCampo } from '@/components/ui/classes-campo'
import { cn } from '@/lib/utils'
import { sanitizarIeDigitos } from '@/lib/documentos'

type Props = {
  ie: string
  ieIsento: boolean
  aoMudarIe: (v: string) => void
  aoMudarIsento: (isento: boolean) => void
  disabled?: boolean
  mensagemDeErro?: string
}

export function CampoInscricaoEstadual({
  ie,
  ieIsento,
  aoMudarIe,
  aoMudarIsento,
  disabled,
  mensagemDeErro,
}: Props) {
  return (
    <div className="space-y-1.5">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold leading-none">Inscrição Estadual (IE)</label>
        <input
          className={cn(classesCampo, mensagemDeErro && 'border-destructive')}
          value={ieIsento ? 'ISENTO' : ie}
          onChange={(e) => aoMudarIe(sanitizarIeDigitos(e.target.value))}
          placeholder="Número da IE"
          maxLength={30}
          disabled={disabled || ieIsento}
          aria-invalid={!!mensagemDeErro}
        />
        {mensagemDeErro && (
          <p className="text-sm text-destructive">{mensagemDeErro}</p>
        )}
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={ieIsento}
          onChange={(e) => aoMudarIsento(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <span className="text-sm font-medium leading-none">Isento (não contribuinte ICMS)</span>
      </label>
    </div>
  )
}
